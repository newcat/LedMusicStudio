<template>
    <div
        ref="rootEl"
        :title="hovered ? tooltipText : undefined"
        class="timeline-item"
        :class="[`--${layout}`, { '--selected': selected, '--no-target': noTarget }]"
        :style="styles"
        @mousedown.self="dragStart('center', $event)"
        @mouseenter="hovered = true"
        @mouseleave="hovered = false"
        @dblclick="openInEditor"
        @contextmenu="onContextMenu"
    >
        <div v-if="color" class="timeline-item__bar" :style="{ background: color }" @mousedown="dragStart('center', $event)"></div>
        <div class="timeline-item__header" @mousedown="dragStart('center', $event)">
            <div class="timeline-item__header-text">{{ layout === "narrow" ? name.slice(0, 1) : name }}</div>
            <i v-if="warnings.length > 0 && layout !== 'narrow'" class="mdi mdi-alert timeline-item__warning"></i>
        </div>
        <i v-if="warnings.length > 0 && layout === 'narrow'" class="mdi mdi-alert timeline-item__warning --narrow" @mousedown="dragStart('center', $event)"></i>
        <div v-if="hasTarget && layout !== 'narrow'" class="timeline-item__chip-row" @mousedown="dragStart('center', $event)">
            <ClipTargetChip :target="item.target" :effective="effective" @update:target="setTarget" />
        </div>
        <div v-show="item.resizable && selected" class="drag-handle --left" @mousedown="dragStart('leftHandle', $event)"></div>
        <div v-show="item.resizable && selected" class="drag-handle --right" @mousedown="dragStart('rightHandle', $event)"></div>
        <div v-if="previewComponent && showPreview" class="preview-container" @mousedown="dragStart('center', $event)">
            <component :is="previewComponent" :item="item" :unit-width="unitWidth"></component>
        </div>

        <!-- fade handles of looks and effects; handles only on hover or selection (FR-032) -->
        <template v-if="hasFades">
            <svg
                v-if="item.fadeIn > 0 || item.fadeOut > 0"
                class="fade-overlay"
                :viewBox="`0 0 ${Math.max(1, widthPx)} ${overlayHeight}`"
                preserveAspectRatio="none"
            >
                <polygon v-if="fadeInPx > 0" :points="`0,0 ${fadeInPx},0 0,${overlayHeight}`" />
                <line v-if="fadeInPx > 0" x1="0" :y1="overlayHeight" :x2="fadeInPx" y2="0" />
                <polygon v-if="fadeOutPx > 0" :points="`${widthPx - fadeOutPx},0 ${widthPx},0 ${widthPx},${overlayHeight}`" />
                <line v-if="fadeOutPx > 0" :x1="widthPx - fadeOutPx" y1="0" :x2="widthPx" :y2="overlayHeight" />
            </svg>
            <div
                v-show="hovered || selected"
                class="fade-handle --in"
                :style="{ left: `${fadeInPx}px` }"
                @mousedown.stop.prevent="startFadeDrag('in', $event)"
            ></div>
            <div
                v-show="hovered || selected"
                class="fade-handle --out"
                :style="{ right: `${fadeOutPx}px` }"
                @mousedown.stop.prevent="startFadeDrag('out', $event)"
            ></div>
        </template>

        <ContextMenu v-if="menuMounted" ref="contextMenu" :model="contextMenuItems" @hide="menuMounted = false" />
    </div>
</template>

<script setup lang="ts">
import { Item, type ClipTarget } from "../model/item";
import { canMakeUnique, FADE_TYPES, TARGET_TYPES, useTimeline } from "../model/editor";
import { ItemArea } from "../types";
import { LibraryItemType, useLibrary } from "@/library";

import { markRaw, computed, ComponentOptions, nextTick, ref, onBeforeUnmount } from "vue";
import ContextMenu from "primevue/contextmenu";
import type { MenuItem } from "primevue/menuitem";
import AudioPreview from "@/audio/AudioPreview.vue";
import AutomationPreview from "@/automation/AutomationPreview.vue";
import GraphPreview from "@/graph/GraphPreview.vue";
import PatternPreview from "@/pattern/PatternPreview.vue";
import EffectPreview from "@/programming/effect/EffectPreview.vue";
import LookPreview from "@/programming/look/LookPreview.vue";
import { buildTargetOptions, decodeTargetValue } from "@/programming/components/TargetSelect.vue";
import { programmingWarnings } from "@/programming/processor";
import { clampFades } from "@/programming/effects";
import { effectiveTarget, targetLabel } from "@/programming/targets";
import { targetColor } from "@/programming/targetColors";
import { useGlobalState } from "@/globalState";
import { snap } from "@/utils";
import { formatBarBeatTick, formatBeats, ticksToSeconds } from "../timeFormat";
import { startGesture, type Gesture } from "../composables/useGesture";
import ClipTargetChip from "./ClipTargetChip.vue";

const ITEM_COMPONENT_MAPPING: Partial<Record<LibraryItemType, ComponentOptions<any>>> = markRaw({
    [LibraryItemType.AUDIO]: AudioPreview,
    [LibraryItemType.GRAPH]: GraphPreview,
    [LibraryItemType.AUTOMATION]: AutomationPreview,
    [LibraryItemType.PATTERN]: PatternPreview,
    [LibraryItemType.LOOK]: LookPreview,
    [LibraryItemType.EFFECT]: EffectPreview,
});

const TYPE_LABELS: Partial<Record<LibraryItemType, string>> = {
    [LibraryItemType.AUDIO]: "Audio",
    [LibraryItemType.GRAPH]: "Graph",
    [LibraryItemType.AUTOMATION]: "Automation",
    [LibraryItemType.PATTERN]: "Pattern",
    [LibraryItemType.SCRIPT]: "Script",
    [LibraryItemType.LOOK]: "Look",
    [LibraryItemType.EFFECT]: "Effect",
};

const props = defineProps({
    item: { type: Object as () => Item, required: true },
    unitWidth: { type: Number, required: true },
});

const emit = defineEmits<{ dragStart: [area: ItemArea, ev: MouseEvent] }>();

const timeline = useTimeline();
const library = useLibrary();
const globalState = useGlobalState();

/** The clip being edited (the prop object itself; edits go through the timeline history). */
const clip = computed(() => props.item);

const rootEl = ref<HTMLElement | null>(null);
const hovered = ref(false);

const name = computed(() => {
    return props.item.libraryItem.name ?? "";
});

const selected = computed(() => timeline.isSelected(props.item.id));

const widthPx = computed(() => (props.item.end - props.item.start) * props.unitWidth);

/** Layout by on-screen width (R12). */
const layout = computed(() => (widthPx.value >= 120 ? "wide" : widthPx.value >= 40 ? "medium" : "narrow"));

const hasTarget = computed(() => TARGET_TYPES.includes(props.item.libraryItem.type));
const effective = computed(() => (hasTarget.value ? effectiveTarget(props.item) : null));
const noTarget = computed(() => hasTarget.value && !effective.value);
const color = computed(() => targetColor(effective.value));

const styles = computed(() => {
    const tint = targetColor(effective.value, 0.12);
    return {
        transform: `translateX(${props.item.start * props.unitWidth}px)`,
        width: `${widthPx.value}px`,
        backgroundImage: tint && !noTarget.value ? `linear-gradient(${tint}, ${tint})` : undefined,
    };
});

const previewComponent = computed(() => {
    return ITEM_COMPONENT_MAPPING[props.item.libraryItem.type];
});

/** Wide: every preview. Medium: previews of clips without a target chip. Narrow: none. */
const showPreview = computed(() => layout.value === "wide" || (layout.value === "medium" && !hasTarget.value));

function dragStart(area: ItemArea, ev: MouseEvent) {
    hovered.value = false;
    emit("dragStart", area, ev);
}

function openInEditor() {
    library.selectedItemId = props.item.libraryItem.id;
}

// --- warnings and tooltip ----------------------------------------------------------------------------------------

const warnings = computed(() => {
    const list = programmingWarnings.get(props.item.id) ?? [];
    return noTarget.value && !list.includes("No target") ? ["No target", ...list] : list;
});

const tooltipText = computed(() => {
    const item = props.item;
    const length = item.end - item.start;
    const lines = [name.value, TYPE_LABELS[item.libraryItem.type] ?? item.libraryItem.type];
    if (hasTarget.value) {
        lines.push(`Target: ${targetLabel(effective.value)}${item.target === "inherit" ? " (inherited from track)" : ""}`);
    }
    lines.push(`Start: ${formatBarBeatTick(item.start)}`);
    lines.push(`Length: ${formatBeats(length)} beats (${ticksToSeconds(length, globalState.bpm).toFixed(2)} s)`);
    if (hasFades.value) {
        lines.push(`Fades: ${formatBeats(effectiveFades.value[0])} / ${formatBeats(effectiveFades.value[1])} beats`);
    }
    if (warnings.value.length > 0) {
        lines.push(...warnings.value.map((w) => `⚠ ${w}`));
    }
    return lines.join("\n");
});

// The tooltip is a native title that is set only while hovered (FR-031): no text is built for 500 clips, and unlike
// the v-tooltip directive (which rebinds its listeners on every re-render) it costs nothing while clips are dragged.

// --- target and context menu -------------------------------------------------------------------------------------

const contextMenu = ref<InstanceType<typeof ContextMenu>>();
/** The menu (and its model) only exists while it is open, so 500 clips don't rebuild menus on selection changes. */
const menuMounted = ref(false);

function setTarget(value: ClipTarget) {
    timeline.edit("Target", () => {
        clip.value.target = value;
    });
}

function setSelectionTarget(value: ClipTarget) {
    const targets = timeline.selectedItems.filter((i) => TARGET_TYPES.includes(i.libraryItem.type));
    timeline.edit("Target", () => {
        targets.forEach((i) => (i.target = value && value !== "inherit" ? { ...value } : value));
    });
}

const contextMenuItems = computed<MenuItem[]>(() => {
    const selection = timeline.selectedItems;
    const menu: MenuItem[] = [];
    if (selection.some((i) => TARGET_TYPES.includes(i.libraryItem.type))) {
        const groups = buildTargetOptions({ allowInherit: true, allowNone: true });
        const toItem = (o: { label: string; value: string }): MenuItem => ({
            label: o.label,
            command: () => {
                const v = decodeTargetValue(o.value);
                if (v !== "clip") {
                    setSelectionTarget(v);
                }
            },
        });
        const targetItems: MenuItem[] = [];
        for (const g of groups) {
            if (g.label === "General") {
                targetItems.push(...g.items.map(toItem));
            } else {
                targetItems.push({ label: g.label, items: g.items.map(toItem) });
            }
        }
        menu.push({ label: "Target", icon: "mdi mdi-target", items: targetItems });
        menu.push({ separator: true });
    }
    menu.push(
        {
            label: "Make unique",
            icon: "mdi mdi-link-variant-off",
            disabled: !selection.some(canMakeUnique),
            command: () => void timeline.makeUnique(timeline.selectedItems),
        },
        { label: "Copy", icon: "mdi mdi-content-copy", command: () => timeline.copySelection() },
        { label: "Duplicate", icon: "mdi mdi-content-duplicate", command: () => timeline.duplicateSelection() },
        { label: "Delete", icon: "mdi mdi-delete", command: () => timeline.deleteSelection() }
    );
    return menu;
});

function onContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (!selected.value) {
        timeline.select([props.item.id], "replace");
        timeline.anchorId = props.item.id;
    }
    menuMounted.value = true;
    void nextTick(() => contextMenu.value?.show(event));
}

// --- fades -------------------------------------------------------------------------------------------------------

const hasFades = computed(() => FADE_TYPES.includes(props.item.libraryItem.type));
const itemLength = computed(() => props.item.end - props.item.start);
const effectiveFades = computed(() => clampFades(itemLength.value, props.item.fadeIn, props.item.fadeOut));
const fadeInPx = computed(() => effectiveFades.value[0] * props.unitWidth);
const fadeOutPx = computed(() => effectiveFades.value[1] * props.unitWidth);
/** The overlay covers the item below the header; percentages in the SVG need a number. */
const overlayHeight = 100;

let fadeGesture: Gesture | null = null;

function startFadeDrag(which: "in" | "out", event: MouseEvent) {
    if (event.button !== 0 || fadeGesture) {
        return;
    }
    const container = rootEl.value?.closest<HTMLElement>(".timeline");
    const startLeft = container?.scrollLeft ?? 0;
    const startX = event.clientX;
    const [startIn, startOut] = effectiveFades.value;
    const startValue = which === "in" ? startIn : startOut;
    timeline.beginGesture();
    const onMove = (e: MouseEvent) => {
        const scrolled = (container?.scrollLeft ?? 0) - startLeft;
        const deltaUnits = (e.clientX - startX + scrolled) / props.unitWidth;
        const raw = which === "in" ? startValue + deltaUnits : startValue - deltaUnits;
        // each fade may span the whole item, limited by the other fade so they never overlap
        const [fi, fo] = effectiveFades.value;
        const max = Math.max(0, itemLength.value - (which === "in" ? fo : fi));
        const value = Math.min(max, Math.max(0, e.shiftKey || e.altKey ? Math.round(raw) : snap(raw)));
        if (which === "in") {
            clip.value.fadeIn = value;
            clip.value.fadeOut = fo;
        } else {
            clip.value.fadeIn = fi;
            clip.value.fadeOut = value;
        }
    };
    fadeGesture = startGesture(
        {
            onMove,
            onEnd: () => {
                fadeGesture = null;
                timeline.endGesture("Fade");
            },
            onCancel: () => {
                fadeGesture = null;
                timeline.cancelGesture();
            },
            autoScroll: container ? { container } : undefined,
        },
        event
    );
}

onBeforeUnmount(() => fadeGesture?.cancel());
</script>

<style scoped>
.timeline-item {
    display: flex;
    flex-direction: column;
    position: absolute;
    height: calc(100% - 10px);
    top: 5px;
    min-width: 4px;
    background-color: var(--p-mask-background);
    border-radius: 3px;
    border: 2px solid transparent;
    transition: border-color 0.1s;
    z-index: 0;
    overflow: visible;
}

.timeline-item.--no-target {
    background-image: repeating-linear-gradient(45deg, rgba(250, 204, 21, 0.16) 0 6px, transparent 6px 12px);
}

.timeline-item:hover:not(.--selected) {
    border-color: var(--p-primary-hover-color);
}

.timeline-item.--selected {
    border-color: var(--p-primary-color);
    z-index: 1;
}

.timeline-item__bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 1px 0 0 1px;
    z-index: 1;
}

.timeline-item__header {
    width: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    overflow: hidden;
    flex: none;
}

.timeline-item__header-text {
    color: var(--p-text-color);
    font-size: 0.75rem;
    padding: 0.1rem;
    margin-left: 5px;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    flex-grow: 1;
}

.--narrow .timeline-item__header-text {
    margin-left: 4px;
    padding: 0.1rem 0;
    text-overflow: clip;
}

.timeline-item__warning {
    color: var(--p-yellow-400, #facc15);
    font-size: 0.85rem;
    margin-right: 4px;
}

.timeline-item__warning.--narrow {
    margin: 0.1rem 0 0 4px;
    font-size: 0.7rem;
}

.timeline-item__chip-row {
    display: flex;
    padding: 0.15rem 0.2rem 0 8px;
    overflow: hidden;
    flex: none;
}

.preview-container {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    position: relative;
}

.drag-handle {
    position: absolute;
    height: 50%;
    width: 6px;
    top: 25%;
    background-color: var(--p-primary-color);
    cursor: col-resize;
    z-index: 2;
}

.drag-handle.--left {
    left: -6px;
    border-radius: 3px 0 0 3px;
}

.drag-handle.--right {
    right: -6px;
    border-radius: 0 3px 3px 0;
}

.fade-overlay {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
}

.fade-overlay polygon {
    fill: rgba(0, 0, 0, 0.35);
}

.fade-overlay line {
    stroke: var(--p-primary-color);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
}

.fade-handle {
    position: absolute;
    top: 0;
    width: 0;
    height: 0;
    border-style: solid;
    cursor: ew-resize;
    z-index: 2;
}

.fade-handle.--in {
    border-width: 9px 9px 0 0;
    border-color: var(--p-primary-color) transparent transparent transparent;
}

.fade-handle.--out {
    border-width: 0 9px 9px 0;
    border-color: transparent var(--p-primary-color) transparent transparent;
}
</style>
