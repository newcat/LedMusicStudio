<template>
    <div
        class="timeline-item"
        :class="{ '--selected': item.selected }"
        :style="styles"
        @mousedown.self="dragStart('center')"
        @contextmenu="onContextMenu"
    >
        <div class="timeline-item__header" :title="name" @mousedown="dragStart('center')">
            <div class="timeline-item__header-text">{{ name }}</div>
            <i v-if="warnings.length > 0" v-tooltip.top="warnings.join('\n')" class="mdi mdi-alert timeline-item__warning"></i>
        </div>
        <div v-show="item.resizable && item.selected" class="drag-handle --left" @mousedown="dragStart('leftHandle')"></div>
        <div v-show="item.resizable && item.selected" class="drag-handle --right" @mousedown="dragStart('rightHandle')"></div>
        <div v-if="previewComponent" class="preview-container" @mousedown="dragStart('center')">
            <component :is="previewComponent" :item="item" :unit-width="unitWidth"></component>
        </div>

        <!-- feature 004: fade handles of looks and effects (R5) -->
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
                v-tooltip.top="'Fade in'"
                class="fade-handle --in"
                :style="{ left: `${fadeInPx}px` }"
                @mousedown.stop.prevent="startFadeDrag('in', $event)"
            ></div>
            <div
                v-tooltip.top="'Fade out'"
                class="fade-handle --out"
                :style="{ right: `${fadeOutPx}px` }"
                @mousedown.stop.prevent="startFadeDrag('out', $event)"
            ></div>
        </template>

        <ContextMenu ref="contextMenu" :model="contextMenuItems" />
        <Dialog v-model:visible="targetDialog" header="Target" modal :style="{ width: '22rem' }">
            <TargetSelect :model-value="item.target" @update:model-value="setTarget" />
        </Dialog>
    </div>
</template>

<script setup lang="ts">
import { Item } from "../model/item";
import { ItemArea } from "../types";
import { LibraryItemType } from "@/library";

import { markRaw, computed, ComponentOptions, ref, onBeforeUnmount } from "vue";
import ContextMenu from "primevue/contextmenu";
import Dialog from "primevue/dialog";
import type { MenuItem } from "primevue/menuitem";
import AudioPreview from "@/audio/AudioPreview.vue";
import AutomationPreview from "@/automation/AutomationPreview.vue";
import GraphPreview from "@/graph/GraphPreview.vue";
import PatternPreview from "@/pattern/PatternPreview.vue";
import EffectPreview from "@/programming/effect/EffectPreview.vue";
import LookPreview from "@/programming/look/LookPreview.vue";
import TargetSelect, { type TargetSelectValue } from "@/programming/components/TargetSelect.vue";
import { programmingWarnings } from "@/programming/processor";
import { clampFades } from "@/programming/effects";
import { snap } from "@/utils";

const ITEM_COMPONENT_MAPPING: Partial<Record<LibraryItemType, ComponentOptions<any>>> = markRaw({
    [LibraryItemType.AUDIO]: AudioPreview,
    [LibraryItemType.GRAPH]: GraphPreview,
    [LibraryItemType.AUTOMATION]: AutomationPreview,
    [LibraryItemType.PATTERN]: PatternPreview,
    [LibraryItemType.LOOK]: LookPreview,
    [LibraryItemType.EFFECT]: EffectPreview,
});

/** Item types that have a target (feature 004). */
const TARGET_TYPES = [LibraryItemType.GRAPH, LibraryItemType.LOOK, LibraryItemType.EFFECT];
/** Item types with fade handles (spec assumption: not graphs). */
const FADE_TYPES = [LibraryItemType.LOOK, LibraryItemType.EFFECT];

const props = defineProps({
    item: { type: Object as () => Item, required: true },
    unitWidth: { type: Number, required: true },
});

const emit = defineEmits(["dragStart"]);

const name = computed(() => {
    return props.item.libraryItem.name ?? "";
});

const widthPx = computed(() => (props.item.end - props.item.start) * props.unitWidth);

const styles = computed(() => {
    return {
        transform: `translateX(${props.item.start * props.unitWidth}px)`,
        width: `${widthPx.value}px`,
    };
});

const previewComponent = computed(() => {
    return ITEM_COMPONENT_MAPPING[props.item.libraryItem.type];
});

function dragStart(area: ItemArea) {
    emit("dragStart", area);
}

// --- target ------------------------------------------------------------------------------------------------------

const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const targetDialog = ref(false);
const hasTarget = computed(() => TARGET_TYPES.includes(props.item.libraryItem.type));
const contextMenuItems = computed<MenuItem[]>(() => [{ label: "Target…", icon: "mdi mdi-target", command: () => (targetDialog.value = true) }]);

function onContextMenu(event: MouseEvent) {
    if (!hasTarget.value) {
        return;
    }
    event.preventDefault();
    contextMenu.value?.show(event);
}

function setTarget(value: TargetSelectValue) {
    props.item.target = value && value !== "clip" ? { ...value } : null;
}

const warnings = computed(() => programmingWarnings.get(props.item.id) ?? []);

// --- fades -------------------------------------------------------------------------------------------------------

const hasFades = computed(() => FADE_TYPES.includes(props.item.libraryItem.type));
const itemLength = computed(() => props.item.end - props.item.start);
const effectiveFades = computed(() => clampFades(itemLength.value, props.item.fadeIn, props.item.fadeOut));
const fadeInPx = computed(() => effectiveFades.value[0] * props.unitWidth);
const fadeOutPx = computed(() => effectiveFades.value[1] * props.unitWidth);
/** The overlay covers the item below the header; percentages in the SVG need a number. */
const overlayHeight = 100;

let stopDrag: (() => void) | null = null;

function startFadeDrag(which: "in" | "out", event: MouseEvent) {
    const startX = event.clientX;
    const [startIn, startOut] = effectiveFades.value;
    const startValue = which === "in" ? startIn : startOut;
    const onMove = (e: MouseEvent) => {
        const deltaUnits = (e.clientX - startX) / props.unitWidth;
        const raw = which === "in" ? startValue + deltaUnits : startValue - deltaUnits;
        // each fade may span the whole item, limited by the other fade so they never overlap
        const [fi, fo] = effectiveFades.value;
        const max = Math.max(0, itemLength.value - (which === "in" ? fo : fi));
        const value = Math.min(max, Math.max(0, e.shiftKey ? Math.round(raw) : snap(raw)));
        if (which === "in") {
            props.item.fadeIn = value;
            props.item.fadeOut = fo;
        } else {
            props.item.fadeIn = fi;
            props.item.fadeOut = value;
        }
    };
    const onUp = () => {
        stopDrag?.();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    stopDrag = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        stopDrag = null;
    };
}

onBeforeUnmount(() => stopDrag?.());
</script>

<style scoped>
.timeline-item {
    display: flex;
    flex-direction: column;
    position: absolute;
    height: calc(100% - 10px);
    top: 5px;
    background-color: var(--p-mask-background);
    border-radius: 3px;
    border: 2px solid transparent;
    transition: border-color 0.1s;
    z-index: 0;
}

.timeline-item:hover:not(.--selected) {
    border-color: var(--p-primary-hover-color);
}

.timeline-item.--selected {
    border-color: var(--p-primary-color);
    z-index: 1;
}

.timeline-item__header {
    width: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
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

.timeline-item__warning {
    color: var(--p-yellow-400, #facc15);
    font-size: 0.85rem;
    margin-right: 4px;
}

.preview-container {
    width: 100%;
    height: 100%;
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
