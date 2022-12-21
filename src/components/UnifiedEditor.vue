<template>
    <Card class="h-full unified-editor">
        <template #header>
            <h2>{{ title }}</h2>
        </template>
        <template #content>
            <baklava-editor
                v-if="isGraph(selectedItem)"
                :view-model="selectedItem.editor.viewModel"
                :key="'g' + selectedItem.id"
            ></baklava-editor>
            <note-editor v-else-if="isPattern(selectedItem)" :notePattern="selectedItem" :key="'p' + selectedItem.id"></note-editor>
            <automation-editor
                v-else-if="isAutomation(selectedItem)"
                :automationClip="selectedItem"
                :key="'a' + selectedItem.id"
            ></automation-editor>
            <output-editor v-else-if="isOutput(selectedItem)" :output="selectedItem" :key="'o' + selectedItem.id"></output-editor>
            <stage-editor v-else-if="isStage(selectedItem)" :output="selectedItem" :key="'s' + selectedItem.id"></stage-editor>
        </template>
    </Card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Card from "primevue/card";
import { EditorComponent as BaklavaEditor } from "@baklavajs/renderer-vue";

import { LibraryItem, LibraryItemType, useLibrary } from "@/library";
import { NoteEditor, PatternLibraryItem } from "@/pattern";
import { AutomationEditor, AutomationLibraryItem } from "@/automation";
import { OutputEditor, OutputLibraryItem } from "@/output";
import { StageEditor, StageLibraryItem } from "@/stage";
import { GraphLibraryItem } from "@/graph";

const library = useLibrary();

const selectedItem = computed(() => {
    return library.selectedItemId ? library.getItemById(library.selectedItemId) : undefined;
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

<style>
.unified-editor {
    display: flex;
    flex-direction: column;
}

.unified-editor > .p-card-body,
.unified-editor > .p-card-body > .p-card-content {
    padding: 0;
    width: 100%;
    height: 100%;
}
</style>
