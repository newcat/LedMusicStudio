<template>
    <Card class="h-full unified-editor">
        <template #header>
            <h2 class="m-4 font-bold text-xl">{{ title }}</h2>
        </template>
        <template #content>
            <GraphEditor v-if="isGraph(selectedItem)" :graph="selectedItem" :key="'g' + selectedItem.id"></GraphEditor>
            <NoteEditor v-else-if="isPattern(selectedItem)" :notePattern="selectedItem" :key="'p' + selectedItem.id"></NoteEditor>
            <AutomationEditor
                v-else-if="isAutomation(selectedItem)"
                :automationClip="selectedItem"
                :key="'a' + selectedItem.id"
            ></AutomationEditor>
        </template>
    </Card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Card from "primevue/card";

import { LibraryItem, LibraryItemType, useLibrary } from "@/library";
import { NoteEditor, PatternLibraryItem } from "@/pattern";
import { AutomationEditor, AutomationLibraryItem } from "@/automation";
import { GraphEditor, GraphLibraryItem } from "@/graph";

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
    flex-grow: 1;
    min-height: 0;
    display: flex;
}
</style>
