<template>
    <main>
        <n-config-provider :theme="darkTheme">
            <div id="app-container">
                <c-toolbar
                    @newProject="newProject"
                    @load="load"
                    @save="save"
                    @saveAs="saveAs"
                    @showSettings="showSettings = true"
                ></c-toolbar>
                <div class="content">
                <splitpanes>
                    <pane min-size="10" size="15">
                        <c-library class="fill-height"></c-library>
                    </pane>
                    <pane>
                        <splitpanes horizontal>
                            <pane>
                                <c-unified-editor class="fill-height" :selectedItemId="selectedLibraryItemId"></c-unified-editor>
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
            <n-global-style />
        </n-config-provider>
    </main>
</template>

<script setup lang="ts">
import { provide, ref } from "vue";
import { NConfigProvider, darkTheme, NGlobalStyle } from "naive-ui";

// @ts-ignore
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

import CLibrary from "@/library/Library.vue";
import CSettings from "@/components/Settings.vue";
import CToolbar from "@/components/MainToolbar.vue";
import CLoadingDialog from "@/components/LoadingDialog.vue";
import CUnifiedEditor from "@/components/UnifiedEditor.vue";
import CTimeline from "@/timeline/Timeline.vue";

import { globalState } from "@/globalState";
import { TimelineProcessor } from "@/timeline";
import { showOpenDialog, showSaveDialog, readFile, writeFile } from "@/native";

const showSettings = ref(false);
const showLoadingDialog = ref(false);
const selectedLibraryItemId = ref("");
const processor = ref(new TimelineProcessor());

processor.value.initialize();
newProject();

async function newProject(): Promise<void> {
    await globalState.reset();
}

provide("selectedLibraryItemId", selectedLibraryItemId);

async function load(): Promise<void> {
    const p = await openLoadDialog();
    if (!p) {
        return;
    }
    const buff = await readFile(p);
    await globalState.reset();
    globalState.projectFilePath = p;
    showLoadingDialog.value = true;
    await globalState.load(buff);
}

async function save(): Promise<void> {
    if (!globalState.projectFilePath) {
        if (!(await openSaveDialog())) {
            return;
        }
    }
    const state = globalState.save();
    await writeFile(globalState.projectFilePath, state);
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
    display: flex;
    flex-direction: column;
}

.content {
    padding: 1rem;
    height: 100%;
}

.n-config-provider {
    height: 100%;
}
</style>
