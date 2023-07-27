<template>
    <main>
        <div id="app-container">
            <c-toolbar @newProject="newProject" @load="load" @save="save" @saveAs="saveAs" @showSettings="showSettings = true"></c-toolbar>
            <div class="content">
                <splitpanes>
                    <pane min-size="10" size="15">
                        <c-library></c-library>
                    </pane>
                    <pane>
                        <splitpanes horizontal>
                            <pane>
                                <c-unified-editor class="fill-height"></c-unified-editor>
                            </pane>
                            <pane>
                                <c-timeline></c-timeline>
                            </pane>
                        </splitpanes>
                    </pane>
                </splitpanes>
            </div>
        </div>
        <c-settings v-model="showSettings"></c-settings>
        <c-loading-dialog v-model="showLoadingDialog"></c-loading-dialog>
        <Toast />
    </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";

// @ts-ignore
import { Splitpanes, Pane } from "splitpanes";

import CLibrary from "@/library/Library.vue";
import CSettings from "@/components/Settings.vue";
import CToolbar from "@/components/MainToolbar.vue";
import CLoadingDialog from "@/components/LoadingDialog.vue";
import CUnifiedEditor from "@/components/UnifiedEditor.vue";
import CTimeline from "@/timeline/Timeline.vue";

import { useGlobalState } from "@/globalState";
import { TimelineProcessor } from "@/timeline";
import { showOpenDialog, showSaveDialog, readFile, writeFile } from "@/native";

const globalState = useGlobalState();
const toast = useToast();

const showSettings = ref(false);
const showLoadingDialog = ref(false);
const processor = ref(new TimelineProcessor());

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

.n-config-provider {
    height: 100%;
}
</style>
