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
import { showOpenDialog, showSaveDialog, readFile, writeFile } from "@/native";
import { useErrorHandler } from "@/utils";

const globalState = useGlobalState();
const toast = useToast();
const errorHandler = useErrorHandler();

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
    const p = await openLoadDialog();
    if (!p) {
        return;
    }
    const buff = await readFile(p);
    await globalState.reset();
    globalState.projectFilePath = p;
    showLoadingDialog.value = true;
    await errorHandler("Failed to load project", async () => {
        await globalState.load(buff);
    });
    showLoadingDialog.value = false;
}

async function save(): Promise<void> {
    if (!globalState.projectFilePath) {
        if (!(await openSaveDialog())) {
            return;
        }
    }

    await errorHandler("Failed to save project", async () => {
        const state = globalState.save();
        await writeFile(globalState.projectFilePath, state);
        toast.add({ severity: "success", summary: "Saved", detail: "Project successfully saved", life: 2000 });
    });
}

async function saveAs(): Promise<void> {
    if (!(await openSaveDialog())) {
        return;
    }
    await save();
}

async function openLoadDialog(): Promise<string> {
    const dialogResult = await showOpenDialog({
        title: "Open Project",
        filters: [{ name: "LedMusic Project", extensions: ["lmp"] }],
    });
    if (dialogResult.canceled) {
        return "";
    }
    return dialogResult.filePaths![0];
}

async function openSaveDialog(): Promise<boolean> {
    const dialogResult = await showSaveDialog({
        title: "Save Project",
        filters: [{ name: "LedMusic Project", extensions: ["lmp"] }],
    });
    if (dialogResult.canceled) {
        return false;
    }
    globalState.projectFilePath = dialogResult.filePath!;
    return true;
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
