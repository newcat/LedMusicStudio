<template>
    <svg class="pattern-preview" :viewBox="viewBox" preserveAspectRatio="none">
        <template v-for="(n, i) in notes" :key="i">
            <line stroke="white" :x1="n.start" :x2="n.end" :y1="n.value" :y2="n.value"></line>
        </template>
    </svg>
</template>

<script setup lang="ts">
import type { PatternLibraryItem } from "./pattern.libraryItem";
import { computed } from "vue";
import { Item } from "@/timeline";

const props = defineProps({
    item: { type: Object as () => Item, required: true },
    unitWidth: { type: Number, required: true },
});

const libraryItem = computed(() => {
    return props.item.libraryItem as PatternLibraryItem;
});

const notes = computed(() => {
    return libraryItem.value.notes;
});

const viewBox = computed(() => {
    const minNoteValue = notes.value.reduce((p, c) => Math.min(p, c.value), 128);
    const maxNoteValue = notes.value.reduce((p, c) => Math.max(p, c.value), 0);
    const height = Math.max(maxNoteValue - minNoteValue + 4, 1);
    const width = props.item.end - props.item.start;
    return `0 ${minNoteValue - 2} ${width} ${height}`;
});
</script>

<style scoped>
.pattern-preview {
    width: 100%;
    height: 100%;
}
</style>
