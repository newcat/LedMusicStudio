<template>
  <div>
    <div id="app-container">
      <c-toolbar
        @newProject="newProject"
        @load="load"
        @save="save"
        @saveAs="saveAs"
        @showSettings="showSettings = true"
      ></c-toolbar>
      <splitpanes>
        <pane min-size="10" size="20">
          <c-library
            class="fill-height"
            @item-selected="onItemSelected"
          ></c-library>
        </pane>
        <pane>
          <splitpanes horizontal>
            <pane>
              <c-unified-editor
                class="fill-height"
                :selectedItemId="selectedLibraryItemId"
              ></c-unified-editor>
            </pane>
            <pane>
              <c-timeline></c-timeline>
            </pane>
          </splitpanes>
        </pane>
      </splitpanes>
    </div>
    <c-settings v-model="showSettings"></c-settings>
    <c-loading-dialog v-model="showLoadingDialog"></c-loading-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { readFile, writeFile } from "fs/promises";
import { dialog } from "@electron/remote";

// @ts-ignore
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

import CLibrary from "@/library/Library.vue";
import CSettings from "@/components/Settings.vue";
import CToolbar from "@/components/Toolbar.vue";
import CLoadingDialog from "@/components/LoadingDialog.vue";
import CUnifiedEditor from "@/components/UnifiedEditor.vue";
import CTimeline from "@/timeline/Timeline.vue";

import { globalState } from "@/globalState";
import { LibraryItem } from "@/library";
import { TimelineProcessor } from "@/timeline";

const showSettings = ref(false);
const showLoadingDialog = ref(false);
const selectedLibraryItemId = ref("");
const processor = ref(new TimelineProcessor());

function created(): void {
  processor.value.initialize();
  newProject();
}

async function newProject(): Promise<void> {
  await globalState.reset();
}

function onItemSelected(item: LibraryItem | undefined) {
  if (item) {
    selectedLibraryItemId.value = item.id;
  } else {
    selectedLibraryItemId.value = "";
  }
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
  const dialogResult = await dialog.showOpenDialog({
    title: "Open Project",
    filters: [{ name: "LedMusic Project", extensions: ["lmp"] }],
  });
  if (dialogResult.canceled) {
    return "";
  }
  return dialogResult.filePaths![0];
}

async function openSaveDialog(): Promise<boolean> {
  const dialogResult = await dialog.showSaveDialog({
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

<style>
#app-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.content-container {
  margin: 5px;
}

html,
body {
  margin: 0;
  padding: 0;
  width: calc(100vw - (100vw - 100%));
  height: 100vh;
}
</style>
