<template>
    <Card class="h-full unified-editor">
        <template #header>{{ title }}</template>
        <template #content>
            <baklava-editor
                v-if="isGraph(selectedItem)"
                :view-model="selectedItem.editor.viewModel"
                :key="'g' + selectedItemId"
            ></baklava-editor>
            <note-editor v-else-if="isPattern(selectedItem)" :notePattern="selectedItem" :key="'p' + selectedItemId"></note-editor>
            <automation-editor
                v-else-if="isAutomation(selectedItem)"
                :automationClip="selectedItem"
                :key="'a' + selectedItemId"
            ></automation-editor>
            <output-editor v-else-if="isOutput(selectedItem)" :output="selectedItem" :key="'o' + selectedItemId"></output-editor>
            <stage-editor v-else-if="isStage(selectedItem)" :output="selectedItem" :key="'s' + selectedItemId"></stage-editor>
        </template>
    </Card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Card from "primevue/card";
import { EditorComponent as BaklavaEditor } from "@baklavajs/renderer-vue";

import { globalState } from "@/globalState";
import { LibraryItem, LibraryItemType } from "@/library";
import { NoteEditor, PatternLibraryItem } from "@/pattern";
import { AutomationEditor, AutomationLibraryItem } from "@/automation";
import { OutputEditor, OutputLibraryItem } from "@/output";
import { StageEditor, StageLibraryItem } from "@/stage";
import { GraphLibraryItem } from "@/graph";

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

function isGraph(item?: LibraryItem): item is GraphLibraryItem {
    return !!item && item.type === LibraryItemType.GRAPH;
}

function isAutomation(item?: LibraryItem): item is AutomationLibraryItem {
    return !!item && item.type === LibraryItemType.AUTOMATION;
}

function isPattern(item?: LibraryItem): item is PatternLibraryItem {
    return !!item && item.type === LibraryItemType.PATTERN;
}

function isOutput(item?: LibraryItem): item is OutputLibraryItem {
    return !!item && item.type === LibraryItemType.OUTPUT;
}

function isStage(item?: LibraryItem): item is StageLibraryItem {
    return !!item && item.type === LibraryItemType.STAGE;
}
</script>

<style scoped>
.unified-editor > :deep(.p-card-content) {
    padding: 0;
}
</style>
