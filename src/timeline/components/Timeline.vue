<template>
    <div
        ref="el"
        class="timeline"
        :class="{ 'disable-child-pointer-events': isDragging }"
        tabindex="-1"
        @mousedown="mousedown"
        @mousemove="onHoverMove"
        @mouseleave="onHoverLeave"
        @keydown="keydown"
        @wheel="wheel"
        @scroll="onScroll"
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
                @drag-start="onDragStart"
                @dragover="$event.preventDefault()"
                @drop.capture="drop(t, $event)"
            ></track-view>
            <selection-rect v-if="boxRect" v-bind="boxRect"></selection-rect>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useElementBounding } from "@vueuse/core";

import { useGlobalState } from "@/globalState";
import { TICKS_PER_BEAT } from "@/constants";
import { normalizeMouseWheel, snap, useTimelineBackground } from "@/utils";

import { ItemArea } from "../types";
import { Item, Track, useTimeline, clampUnitWidth } from "../model";
import { allowedDelta, clampResize, magneticDelta, magneticEdge, snapCandidates, type Span } from "../model/placement";
import { startGesture, type Gesture } from "../composables/useGesture";
import { useTimelineShortcuts } from "../composables/useTimelineShortcuts";

import { LibraryItem, LibraryItemType, useLibrary } from "@/library";
import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { PatternLibraryItem } from "@/pattern";

import MarkerLabel from "@/components/MarkerLabel.vue";
import PositionMarker from "./PositionMarker.vue";
import TrackView from "./Track.vue";
import SelectionRect from "./SelectionRect.vue";

const DEFAULT_ITEM_LENGTH = TICKS_PER_BEAT * 4;
/** Must match `.header-row` and `--rowHeight` below. */
const HEADER_ROW_HEIGHT = 40;
const ROW_HEIGHT = 100;
/** Pointer movement below this many pixels is a click, not a drag. */
const CLICK_TOLERANCE = 3;
/** Magnetic snapping distance in pixels. */
const MAGNET_PX = 8;

const globalState = useGlobalState();
const library = useLibrary();
const timeline = useTimeline();

const el = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const lastItemEnd = ref(0);
const isDragging = ref(false);
let gesture: Gesture | null = null;

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

function updateLastItemEnd() {
    const newLastItemEnd = timeline.items.reduce((p, i) => Math.max(p, i.end), 0);
    if (isDragging.value && newLastItemEnd < lastItemEnd.value) {
        // do nothing because shrinking the content while dragging results in strange behaviour
        return;
    }
    lastItemEnd.value = newLastItemEnd;
}
watch(isDragging, updateLastItemEnd);
watch(() => timeline.items.map((i) => i.end), updateLastItemEnd);

// --- coordinates -------------------------------------------------------------------------------------------------

/** Pointer position in `.content` pixels (accounts for scrolling). */
function contentPoint(ev: MouseEvent): { x: number; y: number } {
    const r = contentEl.value!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function tickAt(ev: MouseEvent): number {
    return (contentPoint(ev).x - timeline.headerWidth) / timeline.unitWidth;
}

/** Track row index under the pointer, unclamped (−1 above the first row). */
function rowAt(y: number): number {
    return Math.floor((y - HEADER_ROW_HEIGHT) / ROW_HEIGHT);
}

// --- hover (paste target track) ----------------------------------------------------------------------------------

function onHoverMove(ev: MouseEvent) {
    if (gesture || !contentEl.value) {
        return;
    }
    const row = rowAt(contentPoint(ev).y);
    timeline.hoveredTrackId = timeline.tracks[row]?.id ?? null;
}

function onHoverLeave() {
    if (!gesture) {
        timeline.hoveredTrackId = null;
    }
}

// --- keyboard ----------------------------------------------------------------------------------------------------

const keydown = useTimelineShortcuts({
    undo: () => timeline.undo(),
    redo: () => timeline.redo(),
    delete: () => timeline.deleteSelection(),
    selectAll: () => timeline.selectAll(),
    escape: () => timeline.clearSelection(),
    copy: () => timeline.copySelection(),
    cut: () => timeline.cutSelection(),
    paste: () => timeline.paste(),
    duplicate: () => timeline.duplicateSelection(),
    nudgeLeft: () => timeline.nudge(-Math.max(1, globalState.snapUnits)),
    nudgeRight: () => timeline.nudge(Math.max(1, globalState.snapUnits)),
    nudgeLeftBar: () => timeline.nudge(-4 * TICKS_PER_BEAT),
    nudgeRightBar: () => timeline.nudge(4 * TICKS_PER_BEAT),
    trackUp: () => timeline.moveSelectionTracks(-1),
    trackDown: () => timeline.moveSelectionTracks(1),
    playPause: () => (globalState.isPlaying = !globalState.isPlaying),
});

// --- mouse -------------------------------------------------------------------------------------------------------

function mousedown(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null;
    if (!target || target.closest("input, textarea, select, [contenteditable]")) {
        return;
    }
    el.value?.focus({ preventScroll: true });
    if (ev.button === 0 && target.closest(".item-container") && !target.closest(".timeline-item")) {
        startBoxSelect(ev);
    }
}

// --- box select (R9) ---------------------------------------------------------------------------------------------

const box = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
const boxRect = computed(() => {
    const b = box.value;
    if (!b) {
        return null;
    }
    return { x: Math.min(b.x0, b.x1), y: Math.min(b.y0, b.y1), width: Math.abs(b.x1 - b.x0), height: Math.abs(b.y1 - b.y0) };
});

function startBoxSelect(ev: MouseEvent) {
    ev.preventDefault();
    const start = contentPoint(ev);
    const startSelection = new Set(timeline.selectedIds);
    const mode = ev.ctrlKey || ev.metaKey ? "toggle" : ev.shiftKey ? "add" : "replace";
    let moved = false;

    const update = (e: MouseEvent) => {
        const p = contentPoint(e);
        if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < CLICK_TOLERANCE) {
            return;
        }
        moved = true;
        isDragging.value = true;
        box.value = { x0: start.x, y0: start.y, x1: p.x, y1: p.y };

        const t0 = (Math.min(start.x, p.x) - timeline.headerWidth) / timeline.unitWidth;
        const t1 = (Math.max(start.x, p.x) - timeline.headerWidth) / timeline.unitWidth;
        const r0 = rowAt(Math.min(start.y, p.y));
        const r1 = rowAt(Math.max(start.y, p.y));
        const trackIds = new Set(timeline.tracks.slice(Math.max(0, r0), Math.max(0, r1 + 1)).map((t) => t.id));
        const hits: string[] = [];
        for (const i of timeline.items) {
            if (trackIds.has(i.trackId) && i.start < t1 && i.end > t0) {
                hits.push(i.id);
            }
        }
        let next: Set<string>;
        if (mode === "replace") {
            next = new Set(hits);
        } else if (mode === "add") {
            next = new Set([...startSelection, ...hits]);
        } else {
            next = new Set(startSelection);
            hits.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
        }
        timeline.select(Array.from(next), "replace");
    };

    const finish = () => {
        box.value = null;
        isDragging.value = false;
        gesture = null;
    };

    gesture = startGesture(
        {
            onMove: update,
            onEnd: (e) => {
                if (!moved) {
                    timeline.clearSelection();
                } else {
                    update(e);
                }
                finish();
            },
            onCancel: () => {
                timeline.select(Array.from(startSelection), "replace");
                finish();
            },
            autoScroll: { container: el.value! },
        },
        ev
    );
}

// --- clip drag and resize (R6, R7, R15) --------------------------------------------------------------------------

function onDragStart(item: Item, area: ItemArea, ev: MouseEvent) {
    if (ev.button !== 0 || gesture) {
        return;
    }
    el.value?.focus({ preventScroll: true });

    // click modes (FR-007)
    let collapseOnClick = false;
    if (ev.ctrlKey || ev.metaKey) {
        timeline.select([item.id], "toggle");
        timeline.anchorId = item.id;
        if (!timeline.isSelected(item.id)) {
            return;
        }
    } else if (ev.shiftKey) {
        timeline.selectRange(item.id);
    } else if (!timeline.isSelected(item.id)) {
        timeline.select([item.id], "replace");
        timeline.anchorId = item.id;
    } else {
        collapseOnClick = true;
        timeline.anchorId = item.id;
    }

    startClipGesture(item, area, ev, collapseOnClick);
}

function startClipGesture(item: Item, area: ItemArea, ev: MouseEvent, collapseOnClick: boolean) {
    const startSelection = Array.from(timeline.selectedIds);
    const copyOnDrag = area === "center" && ev.altKey;
    const startClient = { x: ev.clientX, y: ev.clientY };
    const startTick = tickAt(ev);
    const startRow = rowAt(contentPoint(ev).y);
    let moved = false;
    let dragItemId = item.id;
    let states: Array<{ id: string; start: number; end: number; trackIndex: number; resizable: boolean }> = [];
    let statics: Span[] = [];
    let candidates: number[] = [];
    let lastDelta = 0;
    let byId = new Map<string, Item>();

    const captureStates = () => {
        const selected = timeline.selectedItems;
        const ids = new Set(selected.map((i) => i.id));
        byId = new Map(selected.map((i) => [i.id, i]));
        const trackIndex = new Map(timeline.tracks.map((t, idx) => [t.id, idx]));
        const span = (i: Item): Span => ({ id: i.id, start: i.start, end: i.end, trackIndex: trackIndex.get(i.trackId) ?? -1 });
        states = selected.map((i) => ({ ...span(i), resizable: i.resizable }));
        statics = timeline.items.filter((i) => !ids.has(i.id)).map(span);
        candidates = snapCandidates(statics, globalState.position);
    };

    timeline.beginGesture();
    captureStates();

    const onMove = (e: MouseEvent) => {
        if (!moved) {
            if (Math.hypot(e.clientX - startClient.x, e.clientY - startClient.y) < CLICK_TOLERANCE) {
                return;
            }
            moved = true;
            isDragging.value = true;
            if (copyOnDrag) {
                // Alt+drag (FR-015): drag copies, the originals stay
                const index = timeline.selectedItems.findIndex((i) => i.id === item.id);
                const clones = timeline.cloneSelectionInPlace();
                dragItemId = clones[index]?.id ?? clones[0]?.id ?? item.id;
                captureStates();
            }
        }
        const dragState = states.find((s) => s.id === dragItemId);
        if (!dragState) {
            return;
        }
        const rawDelta = tickAt(e) - startTick;
        const noSnap = e.altKey;
        const threshold = MAGNET_PX / timeline.unitWidth;

        if (area === "center") {
            const minDiff = -Math.min(...states.map((s) => s.trackIndex));
            const maxDiff = timeline.tracks.length - 1 - Math.max(...states.map((s) => s.trackIndex));
            const diffTracks = Math.min(maxDiff, Math.max(minDiff, rowAt(contentPoint(e).y) - startRow));
            const moving = states.map((s) => ({ ...s, trackIndex: s.trackIndex + diffTracks }));

            let delta: number;
            if (noSnap) {
                delta = Math.round(rawDelta);
            } else {
                const magnetic = magneticDelta(moving, candidates, rawDelta, threshold);
                delta = magnetic ?? snap(dragState.start + rawDelta) - dragState.start;
            }
            const allowed = allowedDelta(moving, statics, delta);
            if (allowed === null) {
                return;
            }
            lastDelta = allowed;
            for (const s of moving) {
                const i = byId.get(s.id);
                const track = timeline.tracks[s.trackIndex];
                if (i && track) {
                    if (i.trackId !== track.id) {
                        i.trackId = track.id;
                    }
                    if (i.start !== s.start + lastDelta) {
                        i.move(s.start + lastDelta, s.end + lastDelta);
                    }
                }
            }
        } else {
            const edge = area === "leftHandle" ? "start" : "end";
            const raw = dragState[edge] + rawDelta;
            let value: number;
            if (noSnap) {
                value = Math.round(raw);
            } else {
                value = magneticEdge(raw, candidates, threshold) ?? snap(raw);
            }
            const delta = value - dragState[edge];
            for (const s of states) {
                if (!s.resizable) {
                    continue;
                }
                const i = byId.get(s.id);
                if (!i) {
                    continue;
                }
                const v = clampResize(s, edge, s[edge] + delta, statics);
                i.move(edge === "start" ? v : s.start, edge === "end" ? v : s.end);
            }
        }
    };

    const finish = () => {
        isDragging.value = false;
        gesture = null;
    };

    gesture = startGesture(
        {
            onMove,
            onEnd: () => {
                if (!moved) {
                    timeline.cancelGesture();
                    if (collapseOnClick) {
                        timeline.select([item.id], "replace");
                    }
                } else {
                    timeline.endGesture(copyOnDrag ? "Copy clips" : area === "center" ? "Move" : "Resize");
                }
                finish();
            },
            onCancel: () => {
                timeline.cancelGesture();
                timeline.select(startSelection, "replace");
                finish();
            },
            autoScroll: { container: el.value! },
        },
        ev
    );
}

// --- drop from the library ---------------------------------------------------------------------------------------

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
        case LibraryItemType.LOOK:
        case LibraryItemType.EFFECT:
            item = createItem(DEFAULT_ITEM_LENGTH, libraryItem);
            break;
    }

    if (!item) {
        return;
    }
    const newItem = item;
    timeline.edit("Add clip", () => {
        const unit = Math.max(0, snap(Math.floor(tickAt(ev))));
        newItem.move(unit, unit + (newItem.end - newItem.start));

        // touching clips count as free (FR-045)
        const isOverlapping = (i1: Item, i2: Item) => Math.max(i1.start, i2.start) < Math.min(i1.end, i2.end);
        const isFree = (t: Track) => !(timeline.itemsByTrack.get(t.id) ?? []).some((i) => isOverlapping(i, newItem));

        // the drop track if it is free, else the first free track, else a new one
        const chosenTrack = isFree(track) ? track : ((timeline.tracks as Track[]).find(isFree) ?? timeline.addDefaultTrack());

        newItem.trackId = chosenTrack.id;
        // new clips follow the track's default target live (FR-018)
        newItem.target = "inherit";
        const added = reactive(newItem) as Item;
        timeline.addItem(added);
        timeline.select([added.id], "replace");
        timeline.anchorId = added.id;
    });
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

// --- wheel, follow playhead (R11) --------------------------------------------------------------------------------

function wheel(ev: WheelEvent) {
    if (globalState.isPlaying && timeline.followPlayhead) {
        timeline.followPlayhead = false;
    }
    if (!(ev.ctrlKey || ev.metaKey)) {
        // native scrolling: vertical, Shift = horizontal
        return;
    }
    ev.preventDefault();
    if (!contentEl.value || !el.value) {
        return;
    }

    const amount = normalizeMouseWheel(ev);
    // offset of the pointer relative to the start of the time area
    const bb = contentEl.value.getBoundingClientRect();
    const offsetX = ev.clientX - bb.left - timeline.headerWidth;
    const unit = offsetX / timeline.unitWidth; // the unit which is currently hovered
    timeline.unitWidth = clampUnitWidth(timeline.unitWidth * (1 - amount / 1500));
    // scroll so that the unit stays at the same place visually
    el.value.scrollBy(unitToPixel(unit) - offsetX, 0);
}

let programmaticScroll = false;

function setScrollLeft(value: number) {
    if (!el.value) {
        return;
    }
    const before = el.value.scrollLeft;
    programmaticScroll = true;
    el.value.scrollLeft = Math.max(0, value);
    if (el.value.scrollLeft === before) {
        programmaticScroll = false;
    }
}

function onScroll() {
    if (programmaticScroll) {
        programmaticScroll = false;
        return;
    }
    if (globalState.isPlaying && timeline.followPlayhead && !gesture) {
        timeline.followPlayhead = false;
    }
}

watch(
    () => globalState.position,
    (position) => {
        if (!globalState.isPlaying || !timeline.followPlayhead || !el.value || gesture) {
            return;
        }
        const visibleWidth = el.value.clientWidth - timeline.headerWidth;
        if (visibleWidth <= 0) {
            return;
        }
        const x = unitToPixel(position);
        const left = el.value.scrollLeft;
        if (x > left + 0.9 * visibleWidth || x < left) {
            setScrollLeft(x - 0.1 * visibleWidth);
        }
    }
);

/** For "Zoom to fit" in the toolbar. */
function resetScroll() {
    setScrollLeft(0);
}

function viewWidth(): number {
    return el.value?.clientWidth ?? 0;
}

defineExpose({ resetScroll, viewWidth });

// --- helpers -----------------------------------------------------------------------------------------------------

function unitToPixel(unit: number): number {
    return unit * timeline.unitWidth;
}

function pixelToUnit(pixel: number): number {
    return Math.floor(pixel / timeline.unitWidth);
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

.disable-child-pointer-events :deep(*) {
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
