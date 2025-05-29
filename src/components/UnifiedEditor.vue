<template>
    <Card class="h-full unified-editor">
        <template #header>
            <h2 class="m-4 font-bold text-xl">{{ title }}</h2>
        </template>
        <template #content>
            <Suspense>
                <GraphEditor v-if="isGraph(selectedItem)" :key="'g' + selectedItem.id" :graph="selectedItem"></GraphEditor>
                <NoteEditor v-else-if="isPattern(selectedItem)" :key="'p' + selectedItem.id" :note-pattern="selectedItem"></NoteEditor>
                <AutomationEditor
                    v-else-if="isAutomation(selectedItem)"
                    :key="'a' + selectedItem.id"
                    :automation-clip="selectedItem"
                ></AutomationEditor>
                <ScriptEditor v-if="isScript(selectedItem)" :key="'s' + selectedItem.id" :script="selectedItem" />

                <template #fallback> Loading editor... </template>
            </Suspense>
        </template>
    </Card>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import Card from "primevue/card";

import { LibraryItem, LibraryItemType, useLibrary } from "@/library";
import { PatternLibraryItem } from "@/pattern";
import { AutomationLibraryItem } from "@/automation";
import { GraphLibraryItem } from "@/graph";
import { ScriptLibraryItem } from "@/scripting";

const NoteEditor = defineAsyncComponent(() => import("@/pattern/NoteEditor.vue"));
const AutomationEditor = defineAsyncComponent(() => import("@/automation/AutomationEditor.vue"));
const GraphEditor = defineAsyncComponent(() => import("@/graph/GraphEditor.vue"));
const ScriptEditor = defineAsyncComponent(() => import("@/scripting/ScriptEditor.vue"));

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

function isScript(item?: LibraryItem): item is ScriptLibraryItem {
    return !!item && item.type === LibraryItemType.SCRIPT;
}
</script>

<style scoped>
.unified-editor {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.unified-editor > :deep(.p-card-body),
.unified-editor > :deep(.p-card-body > .p-card-content) {
    padding: 0;
    width: 100%;
    flex-grow: 1;
    min-height: 0;
    display: flex;
}
</style>
