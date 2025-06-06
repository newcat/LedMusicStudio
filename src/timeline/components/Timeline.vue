<template>
    <div
        ref="el"
        class="timeline"
        :class="{ 'disable-child-pointer-events': isDragging }"
        tabindex="-1"
        @mousedown="mousedown"
        @mouseup="mouseup"
        @keydown="keydown"
        @keyup="keyup"
        @wheel="wheel"
    >
        <div ref="contentEl" class="content" :style="contentStyles">
            <position-marker></position-marker>
            <div class="header-row" @click="onHeaderClick">
                <div class="__spacer"></div>
                <div class="__container">
                    <marker-label v-for="m in markers" :key="m.unit" :marker="m"></marker-label>
                </div>
            </div>
            <track-view
                v-for="t in tracks"
                :key="t.id"
                :track="t"
                @mouseenter="onTrackMouseenter(t)"
                @mouseleave="onTrackMouseleave()"
                @mousemove="onTrackMouseMove"
                @drag-start="onDragStart"
                @dragover="$event.preventDefault()"
                @drop.capture="drop(t, $event)"
            ></track-view>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, Ref, ref, watch } from "vue";
import { useElementBounding } from "@vueuse/core";

import { useGlobalState } from "@/globalState";
import { TICKS_PER_BEAT } from "@/constants";
import { normalizeMouseWheel, snap, useTimelineBackground } from "@/utils";

import { ItemArea } from "../types";
import { Item, Track, IItemState, useTimeline } from "../model";

import { LibraryItem, LibraryItemType, useLibrary } from "@/library";
import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { PatternLibraryItem } from "@/pattern";

import MarkerLabel from "@/components/MarkerLabel.vue";
import PositionMarker from "./PositionMarker.vue";
import TrackView from "./Track.vue";

const DEFAULT_ITEM_LENGTH = TICKS_PER_BEAT * 4;

const globalState = useGlobalState();
const library = useLibrary();
const timeline = useTimeline();

const el = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const lastItemEnd = ref(0);
const ctrlPressed = ref(false);
const isDragging = ref(false);
const dragArea = ref<ItemArea | "">("");
const dragItem = ref<Item | null>(null);
const dragStartPosition = ref({ x: 0, y: 0 });
const dragStartTrack = ref<Track | null>(null) as Ref<Track | null>;
const dragStartStates = ref<Array<{ item: IItemState; trackIndex: number }>>([]);
const hoveredTrack = ref<Track | null>(null) as Ref<Track | null>;

const timelineElBounds = useElementBounding(el);

const maxUnit = computed(() => {
    return Math.max(pixelToUnit(timelineElBounds.width.value - timeline.headerWidth - 10), lastItemEnd.value + globalState.snapUnits);
});

const { markers, styles: backgroundStyles } = useTimelineBackground(
    computed(() => timeline.unitWidth),
    maxUnit
);

const contentStyles = computed(() => {
    return {
        width: `${(lastItemEnd.value + globalState.snapUnits) * timeline.unitWidth + timeline.headerWidth}px`,
        ...backgroundStyles.value,
    };
});

const tracks = computed(() => {
    return timeline.tracks as Track[];
});

function unselectAllItems() {
    timeline.items.forEach((i) => {
        i.selected = false;
    });
}

function updateLastItemEnd() {
    const newLastItemEnd = timeline.items.reduce((p, i) => Math.max(p, i.end), 0);
    if (dragItem.value && newLastItemEnd < lastItemEnd.value) {
        // do nothing because shrinking the content while dragging results in strange behaviour
        return;
    }
    lastItemEnd.value = newLastItemEnd;
}
watch(dragItem, updateLastItemEnd);
watch(() => timeline.items.map((i) => i.end), updateLastItemEnd);

function mousedown(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null;
    if (target && !isSelfOrIsChildOf(target, ".timeline-item")) {
        unselectAllItems();
    }
    isDragging.value = true;
    dragStartPosition.value = { x: ev.clientX, y: ev.clientY };
}

function mouseup() {
    isDragging.value = false;
    dragItem.value = null;
}

function keydown(ev: KeyboardEvent) {
    ev.preventDefault();
    if (ev.key === "Delete") {
        const itemsToDelete = timeline.items.filter((i) => i.selected);
        itemsToDelete.forEach((i) => timeline.removeItem(i));
    } else if (ev.key === " ") {
        globalState.isPlaying = !globalState.isPlaying;
    } else if (ev.key === "Control") {
        ctrlPressed.value = true;
    }
}

function keyup(ev: KeyboardEvent) {
    ev.preventDefault();
    if (ev.key === "Control") {
        ctrlPressed.value = false;
    }
}

function onTrackMouseMove(ev: MouseEvent) {
    const x = ev.clientX;
    const diffUnits = Math.floor((x - dragStartPosition.value.x) / timeline.unitWidth);
    if (isDragging.value && dragItem.value) {
        if (dragArea.value === "leftHandle" || dragArea.value === "rightHandle") {
            dragStartStates.value.forEach((state) => {
                const newStart = dragArea.value === "leftHandle" ? snap(state.item.start + diffUnits) : state.item.start;
                const newEnd = dragArea.value === "rightHandle" ? snap(state.item.end + diffUnits) : state.item.end;
                const item = timeline.items.find((i) => i.id === state.item.id);
                if (item) {
                    item.move(newStart, newEnd);
                }
            });
        } else if (dragArea.value === "center") {
            let diffTracks = 0;
            if (dragStartTrack.value && hoveredTrack.value) {
                const startTrackIndex = timeline.tracks.indexOf(dragStartTrack.value);
                const endTrackIndex = timeline.tracks.indexOf(hoveredTrack.value);
                if (startTrackIndex >= 0 && endTrackIndex >= 0) {
                    diffTracks = endTrackIndex - startTrackIndex;
                }
            }

            // check if some items would be dragged outside of the track bounds
            dragStartStates.value.forEach((state) => {
                const trackIndex = state.trackIndex;
                const newTrackIndex = trackIndex + diffTracks;
                if (newTrackIndex < 0) {
                    diffTracks = -trackIndex;
                } else if (newTrackIndex >= timeline.tracks.length) {
                    diffTracks = timeline.tracks.length - trackIndex;
                }
            });

            dragStartStates.value.forEach((state) => {
                const item = timeline.items.find((j) => j.id === state.item.id)!;
                const newTrackIndex = state.trackIndex + diffTracks;
                const newTrack = timeline.tracks[newTrackIndex];
                const newStart = snap(state.item.start + diffUnits);
                const newEnd = newStart + (state.item.end - state.item.start);
                item.trackId = newTrack.id;
                item.move(newStart, newEnd);
            });
        }
    }
}

function onDragStart(item: Item, area: ItemArea) {
    if (!ctrlPressed.value) {
        unselectAllItems();
    }
    item.selected = true;
    dragItem.value = item;
    dragArea.value = area;
    dragStartTrack.value = hoveredTrack.value;
    isDragging.value = true;
    dragStartStates.value = timeline.items
        .filter((i) => i.selected)
        .map((i) => ({
            item: i.save(),
            trackIndex: timeline.tracks.findIndex((t) => t.id === i.trackId),
        }));
}

function onTrackMouseenter(track: Track): void {
    hoveredTrack.value = track;
}

function onTrackMouseleave(): void {
    hoveredTrack.value = null;
}

function drop(track: Track, ev: DragEvent) {
    const id = ev.dataTransfer!.getData("id");
    const libraryItem = library.getItemById(id);
    if (!libraryItem) {
        return;
    }

    let item: Item | undefined;
    switch (libraryItem.type) {
        case LibraryItemType.AUDIO:
            item = addMusicItem(libraryItem as AudioLibraryItem);
            break;
        case LibraryItemType.GRAPH:
            item = createItem(DEFAULT_ITEM_LENGTH, libraryItem);
            break;
        case LibraryItemType.AUTOMATION:
            item = addAutomationItem(libraryItem as AutomationLibraryItem);
            break;
        case LibraryItemType.PATTERN:
            item = addPatternItem(libraryItem as PatternLibraryItem);
            break;
        case LibraryItemType.SCRIPT:
            item = createItem(DEFAULT_ITEM_LENGTH, libraryItem);
            break;
    }

    if (item) {
        const x = ev.offsetX;
        const unit = snap(pixelToUnit(x));
        item.move(unit, unit + (item.end - item.start));

        const isOverlapping = (i1: Item, i2: Item) => Math.max(i1.start, i2.start) <= Math.min(i1.end, i2.end);

        // check, whether the track is free
        let chosenTrack: Track | undefined;
        const trackItems = timeline.items.filter((i) => i.trackId === track.id);

        if (!trackItems.some((i) => isOverlapping(i as Item, item!))) {
            chosenTrack = track;
        }

        // if unsuccessful, find a free track
        if (!chosenTrack) {
            chosenTrack = timeline.tracks.find((t) => {
                const trackItems = timeline.items.filter((i) => i.trackId === t.id);

                return !trackItems.some((i) => isOverlapping(i as Item, item!));
            }) as Track;
        }

        // if no free track was found, create a new one
        if (!chosenTrack) {
            chosenTrack = timeline.addDefaultTrack();
        }

        item.trackId = chosenTrack.id;
        timeline.addItem(reactive(item) as Item);
    }
}

function onHeaderClick(ev: MouseEvent): void {
    let x = ev.offsetX;
    if ((ev.target as HTMLElement).classList.contains("__spacer")) {
        // clicked on the padding area on top of the track headers
        x = el.value!.scrollLeft;
    }

    const tick = pixelToUnit(x);
    globalState.setPositionByUser(snap(tick));
}

function wheel(ev: WheelEvent) {
    ev.preventDefault();

    if (!contentEl.value) {
        return;
    }

    const amount = normalizeMouseWheel(ev);
    // get offset relative to the content element
    const bb = contentEl.value.getBoundingClientRect();
    const offsetX = ev.screenX - bb.left - timeline.headerWidth;
    const unit = pixelToUnit(offsetX); // the unit which is currently hovered
    timeline.unitWidth *= 1 - amount / 1500;
    // scroll so that the unit stays at the same place visually
    el.value!.scrollBy(unitToPixel(unit) - offsetX, 0);
}

function unitToPixel(unit: number): number {
    return unit * timeline.unitWidth;
}

function pixelToUnit(pixel: number): number {
    return Math.floor(pixel / timeline.unitWidth);
}

function isSelfOrIsChildOf(el: HTMLElement, selector: string) {
    if (el.matches(selector)) {
        return true;
    }
    while (!el.matches(".timeline") && !!el.parentElement) {
        if (el.matches(selector)) {
            return true;
        }
        el = el.parentElement;
    }
    return false;
}

function addMusicItem(libraryItem: AudioLibraryItem): Item | undefined {
    if (libraryItem.loading) {
        return;
    }
    const length = libraryItem.audioBuffer!.duration * (globalState.bpm / 60) * TICKS_PER_BEAT;
    const item = createItem(length, libraryItem);
    item.resizable = false;
    return item;
}

function addAutomationItem(libraryItem: AutomationLibraryItem): Item {
    const length = libraryItem.points.reduce((p, c) => Math.max(p, c.unit), 0);
    return createItem(length, libraryItem);
}

function addPatternItem(libraryItem: PatternLibraryItem): Item {
    const length = libraryItem.notes.reduce((p, c) => Math.max(p, c.end), 0);
    return createItem(length, libraryItem);
}

function createItem(length: number, libraryItem: LibraryItem) {
    // set the track id to "" temporarily, we will determine the track later
    const item = new Item(libraryItem, "", 0, length);
    return item;
}
</script>

<style scoped>
.timeline {
    --rowHeight: 100px;
    --headerWidth: 200px;

    overflow: auto;
    width: 100%;
    height: 100%;
    background-color: var(--p-panel-background);
}

.timeline:focus {
    outline: none;
}

.--disable-child-pointer-events * {
    pointer-events: none;
}

.content {
    position: relative;
    background-position: calc(var(--headerWidth) - 1px) -1px;
    min-width: 100%;
}
.content:focus {
    outline: none;
}

.header-row {
    height: 40px;
    background-color: var(--p-form-field-background);
    position: sticky;
    top: 0;
    z-index: 4;
}

.header-row > .__spacer {
    width: var(--headerWidth);
    height: 100%;
    position: sticky;
    background-color: var(--p-form-field-background);
    left: 0;
    z-index: 5;
}

.header-row > .__container {
    position: absolute;
    top: 0;
    left: var(--headerWidth);
    height: 100%;
    width: calc(100% - var(--headerWidth));
    z-index: 4;
}
</style>
