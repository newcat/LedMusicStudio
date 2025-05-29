<template>
    <div ref="el" class="note-editor">
        <div
            class="__content"
            tabindex="-1"
            :style="contentStyles"
            @mousedown="mousedown"
            @mouseup="mouseup"
            @wheel="wheel"
            @keydown="keydown"
            @keyup="keyup"
        >
            <div class="__header-row">
                <div class="__header"></div>
                <div class="__marker-container">
                    <MarkerLabel v-for="m in background.markers.value" :key="m.unit" :marker="m"></MarkerLabel>
                </div>
            </div>

            <div v-for="i in 128" :key="i" class="__row" :data-row-value="i">
                <div class="__header">
                    <div>{{ i }}</div>
                </div>
                <div
                    class="__note-container"
                    @mouseenter="onRowMouseenter(i)"
                    @mousemove="onRowMouseMove"
                    @mousedown.self="createNote(i, $event)"
                >
                    <c-note
                        v-for="n in getNotesForTrack(i)"
                        :key="n.id"
                        :note="n"
                        :tick-width="tickWidth"
                        :style="{ pointerEvents: disableNotePointerEvents ? 'none' : undefined }"
                        @drag-start="onDragStart(n, $event)"
                        @resize-start="onResizeStart(n, $event)"
                    ></c-note>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { PatternLibraryItem } from "./pattern.libraryItem";

import { v4 as uuidv4 } from "uuid";
import { computed, ref, watch } from "vue";
import { useElementBounding } from "@vueuse/core";

import { useGlobalState } from "@/globalState";
import { normalizeMouseWheel, useTimelineBackground } from "@/utils";
import { INote } from "./types";
import CNote from "./Note.vue";
import MarkerLabel from "@/components/MarkerLabel.vue";

const props = defineProps({
    notePattern: { type: Object as () => PatternLibraryItem, required: true },
});

const globalState = useGlobalState();

const el = ref<HTMLElement | null>(null);
const tickWidth = ref(6);
const headerWidth = ref(50);
const lastNoteEnd = ref(0);
const altKeyPressed = ref(false);

const draggedNote = ref<INote | null>(null);
const dragOffset = ref(0);

const resizedNote = ref<INote | null>(null);
const resizeOffset = ref(0);

const bounds = useElementBounding(el);
const maxUnit = computed(() => {
    return Math.max(Math.floor((bounds.width.value - headerWidth.value - 10) / tickWidth.value), lastNoteEnd.value + globalState.snapUnits);
});
const background = useTimelineBackground(tickWidth, maxUnit);

const contentStyles = computed(() => {
    return {
        width: `${(lastNoteEnd.value + snap.value) * tickWidth.value + headerWidth.value}px`,
        ...background.styles.value,
    };
});

const disableNotePointerEvents = computed(() => {
    return !!draggedNote.value || !!resizedNote.value;
});

const snap = computed(() => {
    return globalState.snapUnits;
});

function getNotesForTrack(track: number) {
    return props.notePattern.notes.filter((n) => n.value === track);
}

function unselectAllNotes() {
    props.notePattern.notes.forEach((n) => {
        n.selected = false;
    });
}

function updateLastNoteEnd() {
    const newLastNoteEnd = props.notePattern.notes.reduce((p, n) => Math.max(p, n.end), 0);
    if (newLastNoteEnd < lastNoteEnd.value && (draggedNote.value || resizedNote.value)) {
        // do nothing because shrinking the content while dragging results in strange behaviour
        return;
    }
    lastNoteEnd.value = newLastNoteEnd;
}
watch(() => props.notePattern.notes, updateLastNoteEnd, { deep: true, immediate: true });
watch([draggedNote, resizedNote], updateLastNoteEnd);

function mousedown(ev: MouseEvent) {
    if (!clickedOnNote(ev)) {
        props.notePattern.notes.forEach((n) => {
            n.selected = false;
        });
    }
}

function mouseup() {
    draggedNote.value = null;
    resizedNote.value = null;
}

function wheel(ev: WheelEvent) {
    ev.preventDefault();
    const amount = normalizeMouseWheel(ev);
    const tick = ev.offsetX / tickWidth.value; // the tick which is currently hovered
    tickWidth.value *= 1 - amount / 1500;
    // scroll so that the tick stays at the same place visually
    el.value!.scrollBy(tick * tickWidth.value - ev.offsetX, 0);
}

function keydown(ev: KeyboardEvent) {
    if (ev.key === "Delete") {
        const noteIndicesToDelete = props.notePattern.notes.map((v, i) => (v.selected ? i : -1)).filter((i) => i >= 0);
        noteIndicesToDelete.reverse();
        noteIndicesToDelete.forEach((i) => props.notePattern.notes.splice(i, 1));
    } else if (ev.key === "Alt") {
        altKeyPressed.value = true;
    }
}

function keyup(ev: KeyboardEvent) {
    if (ev.key === "Alt") {
        altKeyPressed.value = false;
    }
}

function onRowMouseenter(rowValue: number) {
    if (draggedNote.value && draggedNote.value.value !== rowValue) {
        draggedNote.value.value = rowValue;
    }
}

function onRowMouseMove(ev: MouseEvent) {
    if (draggedNote.value) {
        const newStart = performSnap((ev.offsetX - dragOffset.value) / tickWidth.value);
        const newEnd = newStart + (draggedNote.value.end - draggedNote.value.start);
        if (newStart >= 0) {
            draggedNote.value.start = newStart;
            draggedNote.value.end = newEnd;
        }
    } else if (resizedNote.value) {
        const newEnd = performSnap(ev.offsetX / tickWidth.value);
        if (newEnd > resizedNote.value.start) {
            resizedNote.value.end = newEnd;
        }
    }
}

function onDragStart(note: INote, offset: number) {
    unselectAllNotes();
    draggedNote.value = note;
    dragOffset.value = offset;
    draggedNote.value.selected = true;
}

function onResizeStart(note: INote, offset: number) {
    unselectAllNotes();
    resizedNote.value = note;
    resizeOffset.value = offset;
    resizedNote.value.selected = true;
}

function createNote(value: number, ev: MouseEvent) {
    if (props.notePattern.notes.every((n) => !n.selected)) {
        let start = ev.offsetX / tickWidth.value;
        start = start - (start % snap.value);
        props.notePattern.notes.push({
            id: uuidv4(),
            start,
            end: start + snap.value,
            value,
            selected: false,
        });
    }
}

function performSnap(tick: number) {
    if (altKeyPressed.value) {
        return tick;
    }
    const mod = tick % snap.value;
    return mod <= snap.value / 2 ? tick - mod : tick + snap.value - mod;
}

function clickedOnNote(ev: MouseEvent) {
    return ev
        .composedPath()
        .filter((t) => t instanceof HTMLElement)
        .some((t) => t.matches(".note"));
}
</script>

<style scoped>
.note-editor {
    --row-height: 30px;
    --header-width: 50px;

    overflow-y: scroll;
    width: 100%;
}

.__content {
    position: relative;
    background-position: calc(var(--header-width) - 1px) -1px;
    min-width: 100%;
}

.__content:focus {
    outline: none;
}

.__row {
    height: var(--row-height);
    border-bottom: 1px solid var(--p-form-field-disabled-background);
    display: flex;
    z-index: 20;
}

.__header {
    position: sticky;
    left: 0;
    min-width: var(--header-width);
    max-width: var(--header-width);
    height: 100%;
    background-color: var(--p-form-field-background);
    color: #bbb;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
}

.__header-row {
    width: 100%;
    height: var(--row-height);
    background-color: var(--p-form-field-background);
    display: flex;
}

.__marker-container {
    position: relative;
}

.__note-container {
    position: relative;
    width: 100%;
    height: 100%;
}
</style>
