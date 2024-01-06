<template>
    <main>
        <div id="app-container">
            <Toolbar
                v-model:view="currentView"
                @newProject="newProject"
                @load="load"
                @save="save"
                @saveAs="saveAs"
                @showSettings="showSettings = true"
            />
            <div class="content">
                <Programming v-show="currentView === 'PROGRAMMING'" />
                <Stage v-show="currentView === 'STAGE'" />
                <Visualization v-show="currentView === 'VISUALIZATION'" />
            </div>
        </div>
        <Settings v-model="showSettings" />
        <LoadingDialog v-model="showLoadingDialog" />
        <Toast />
    </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";

import Settings from "@/components/Settings.vue";
import Toolbar from "@/components/MainToolbar.vue";
import LoadingDialog from "@/components/LoadingDialog.vue";
import { Programming, Stage, Visualization } from "@/views";

import { useGlobalState } from "@/globalState";
import { TimelineProcessor } from "@/timeline";
import { useStage } from "@/stage";
import { getNativeAdapter } from "@/native";
import { useErrorHandler } from "@/utils";

const globalState = useGlobalState();
const toast = useToast();
const errorHandler = useErrorHandler();
const nativeAdapter = getNativeAdapter();

const showSettings = ref(false);
const showLoadingDialog = ref(false);
const processor = ref(new TimelineProcessor());
const currentView = ref<"PROGRAMMING" | "STAGE" | "VISUALIZATION">("STAGE");

(window as any).globalState = globalState;
(window as any).processor = processor;
(window as any).stage = useStage();

newProject();

async function newProject(): Promise<void> {
    await globalState.reset();
}

async function load(): Promise<void> {
    const result = await nativeAdapter.chooseAndReadFile({
        accept: [{ name: "LedMusic Project", extensions: ["lmp"] }],
    });
    if (!result) {
        return;
    }

    await globalState.reset();
    globalState.projectFilePath = result.path ?? "";
    showLoadingDialog.value = true;
    await errorHandler("Failed to load project", async () => {
        await globalState.load(result.dataAsString);
    });
}

async function save(): Promise<void> {
    const showSuccessToast = () => {
        toast.add({ severity: "success", summary: "Saved", detail: "Project successfully saved", life: 2000 });
    };

    if (globalState.projectFilePath && nativeAdapter.isElectron()) {
        await errorHandler("Failed to save project", async () => {
            const state = globalState.save();
            await nativeAdapter.writeFile(globalState.projectFilePath, state);
            showSuccessToast();
        });
    } else {
        const data = new TextEncoder().encode(globalState.save());
        const result = await nativeAdapter.chooseAndWriteFile(data, {
            accept: [{ name: "LedMusic Project", extensions: ["lmp"] }],
            suggestedName: "project.lmp",
        });
        if (result) {
            showSuccessToast();
        }
    }
}

async function saveAs() {
    if (!nativeAdapter.isElectron()) {
        throw new Error("Save-as is only supported in Electron");
    }

    const dialogResult = await nativeAdapter.showSaveDialog({
        title: "Save Project",
        filters: [{ name: "LedMusic Project", extensions: ["lmp"] }],
    });
    if (dialogResult.canceled) {
        return;
    }
    globalState.projectFilePath = dialogResult.filePath!;
    await save();
}
</script>

<style scoped>
main {
    height: 100vh;
}

#app-container {
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-rows: min-content minmax(0, 1fr);
    grid-template-columns: 100%;
}

.content {
    padding: 1rem;
    height: 100%;
}
</style>
