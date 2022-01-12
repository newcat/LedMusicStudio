<template>
    <n-card class="full-height" :title="title">
        <baklava-editor v-if="isGraph" :plugin="selectedItem.editor.viewPlugin" :key="'g' + selectedItemId"></baklava-editor>
        <note-editor v-else-if="isPattern" :notePattern="selectedItem" :key="'p' + selectedItemId"></note-editor>
        <automation-editor v-else-if="isAutomation" :automationClip="selectedItem" :key="'a' + selectedItemId"></automation-editor>
        <output-editor v-else-if="isOutput" :output="selectedItem" :key="'o' + selectedItemId"></output-editor>
        <stage-editor v-else-if="isStage" :output="selectedItem" :key="'s' + selectedItemId"></stage-editor>
    </n-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NCard } from "naive-ui";
import { EditorComponent as BaklavaEditor } from "@baklavajs/renderer-vue";

import { globalState } from "@/globalState";
import { LibraryItemType } from "@/library";
import { NoteEditor } from "@/pattern";
import { AutomationEditor } from "@/automation";
import { OutputEditor } from "@/output";
import { StageEditor } from "@/stage";

const props = defineProps({
    selectedItemId: { type: String, default: "" },
});

const selectedItem = computed(() => {
    return globalState.library.getItemById(props.selectedItemId);
});

const title = computed(() => {
    let t = "Editor";
    if (selectedItem.value) {
        t += ` (${selectedItem.value.name})`;
    }
    return t;
});

const isGraph = computed(() => {
    return selectedItem.value?.type === LibraryItemType.GRAPH;
});

const isAutomation = computed(() => {
    return selectedItem.value?.type === LibraryItemType.AUTOMATION;
});

const isPattern = computed(() => {
    return selectedItem.value?.type === LibraryItemType.PATTERN;
});

const isOutput = computed(() => {
    return selectedItem.value?.type === LibraryItemType.OUTPUT;
});

const isStage = computed(() => {
    return selectedItem.value?.type === LibraryItemType.STAGE;
});
</script>
