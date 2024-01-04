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
import Programming from "./Programming.vue";
import Stage from "./stage/components/Stage.vue";

import { useGlobalState } from "@/globalState";
import { TimelineProcessor } from "@/timeline";
import { showOpenDialog, showSaveDialog, readFile, writeFile } from "@/native";

const globalState = useGlobalState();
const toast = useToast();

const showSettings = ref(false);
const showLoadingDialog = ref(false);
const processor = ref(new TimelineProcessor());
const currentView = ref<"PROGRAMMING" | "STAGE">("STAGE");

(window as any).globalState = globalState;
(window as any).processor = processor;

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
    try {
        await globalState.load(buff);
    } catch (err) {
        console.error(err);
        toast.add({
            severity: "error",
            closable: true,
            summary: "Failed to load project",
            detail: err instanceof Error ? err.message : String(err),
            life: 6000,
        });
        showLoadingDialog.value = false;
    }
}

async function save(): Promise<void> {
    if (!globalState.projectFilePath) {
        if (!(await openSaveDialog())) {
            return;
        }
    }
    try {
        const state = globalState.save();
        await writeFile(globalState.projectFilePath, state);
        toast.add({ severity: "success", summary: "Saved", detail: "Project successfully saved", life: 2000 });
    } catch (err) {
        toast.add({
            severity: "error",
            closable: true,
            summary: "Failed to save project",
            detail: err instanceof Error ? err.message : String(err),
            life: 6000,
        });
        showLoadingDialog.value = false;
    }
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
