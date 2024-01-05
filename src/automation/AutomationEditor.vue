<template>
    <div ref="el" class="automation-editor">
        <svg
            ref="svgEl"
            :style="{ width: `${width}px` }"
            @mouseup="mouseup"
            @mousemove="mousemove"
            @mouseleave="mouseup"
            @dblclick="dblclick"
            @wheel="wheel"
        >
            <!-- grid lines ----->
            <!-- border-->
            <line class="border" :x1="getXCoordinate(0)" :x2="horizontalLineWidth" :y1="getYCoordinate(0)" :y2="getYCoordinate(0)"></line>
            <line class="border" :x1="getXCoordinate(0)" :x2="getXCoordinate(0)" :y1="getYCoordinate(0)" :y2="getYCoordinate(1)"></line>
            <!-- horizontal-->
            <line
                class="h-grid-line"
                v-for="i in 5"
                :key="i"
                :x1="getXCoordinate(0)"
                :x2="horizontalLineWidth"
                :y1="getYCoordinate(i / 5)"
                :y2="getYCoordinate(i / 5)"
            ></line>
            <!-- vertical-->
            <line
                class="v-grid-line"
                v-for="(x, i) in verticalLines"
                :key="i"
                :x1="x"
                :x2="x"
                :y1="getYCoordinate(0)"
                :y2="getYCoordinate(1)"
            ></line>

            <!-- lines ----->
            <template v-for="(p, i) in points">
                <template v-if="i &gt; 0">
                    <template v-if="p.type === 'linear'">
                        <line
                            :key="p.id + '-line'"
                            :x1="getXCoordinate(points[i - 1].unit)"
                            :x2="getXCoordinate(p.unit)"
                            :y1="getYCoordinate(points[i - 1].value)"
                            :y2="getYCoordinate(p.value)"
                        ></line>
                    </template>
                    <template v-else-if="p.type === 'step'">
                        <line
                            :key="p.id + '-line-1'"
                            :x1="getXCoordinate(points[i - 1].unit)"
                            :x2="getXCoordinate(p.unit)"
                            :y1="getYCoordinate(points[i - 1].value)"
                            :y2="getYCoordinate(points[i - 1].value)"
                        ></line>
                        <line
                            :key="p.id + '-line-2'"
                            :x1="getXCoordinate(p.unit)"
                            :x2="getXCoordinate(p.unit)"
                            :y1="getYCoordinate(points[i - 1].value)"
                            :y2="getYCoordinate(p.value)"
                        ></line>
                    </template>
                </template>
            </template>

            <!-- points ----->
            <circle
                v-for="p in points"
                @mousedown="mousedown(p.id)"
                :key="p.id + '-point'"
                :class="{ '--dragged': draggedPoint === p }"
                :cx="getXCoordinate(p.unit)"
                :cy="getYCoordinate(p.value)"
                r="5"
            ></circle>

            <!-- drag value popup ----->
            <g v-if="popupWindow" :transform="`translate(${popupWindow.x}, ${popupWindow.y})`">
                <rect x="0" y="0" width="40" height="20" fill="black" fill-opacity="0.6"></rect>
                <text x="20" y="10" font-size="12" fill="white" dominant-baseline="middle" text-anchor="middle">
                    {{ popupWindow.text }}
                </text>
            </g>
        </svg>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { TICKS_PER_BEAT } from "@/constants";
import { clamp, normalizeMouseWheel, snap } from "@/utils";
import { AutomationLibraryItem, IAutomationPoint } from "./automation.libraryItem";
import { useGlobalState } from "@/globalState";

const props = defineProps({
    automationClip: { type: Object as () => AutomationLibraryItem, required: true },
});

const globalState = useGlobalState();

const el = ref<HTMLElement | null>(null);
const svgEl = ref<SVGElement | null>(null);

const padding = ref(20);
const height = ref(200);
const unitWidth = ref(1);
const lastPointUnit = ref(0);

const resizeObserver = ref<ResizeObserver | null>(null);
const scrollTicker = ref<ReturnType<typeof setTimeout> | null>(null);
const scrollAmount = ref(0);

const draggedPoint = ref<IAutomationPoint | null>(null);

const points = computed(() => props.automationClip.points);

const width = computed(() => getXCoordinate(lastPointUnit.value + 4 * TICKS_PER_BEAT));

const horizontalLineWidth = computed(() => {
    let elWidth = 0;
    if (el.value) {
        elWidth = el.value.clientWidth;
    }
    return Math.max(width.value, elWidth) - padding.value;
});

const verticalLines = computed(() => {
    const xCoords = [];
    let unit = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        unit += globalState.snapUnits * 4;
        const x = getXCoordinate(unit);
        if (x > horizontalLineWidth.value) {
            break;
        }
        xCoords.push(x);
    }
    return xCoords;
});

const popupWindow = computed(() => {
    if (!draggedPoint.value) {
        return undefined;
    }
    const x = getXCoordinate(draggedPoint.value.unit) - 20;
    let y = getYCoordinate(draggedPoint.value.value);
    y += draggedPoint.value.value > 0.8 ? 20 : -35;
    const text = draggedPoint.value.value.toFixed(2);
    return { x, y, text };
});

function updateLastPointUnit() {
    const newLastPointUnit = points.value[points.value.length - 1].unit;
    if (draggedPoint.value && newLastPointUnit < lastPointUnit.value) {
        // do nothing because shrinking the content while dragging results in strange behaviour
        return;
    }
    lastPointUnit.value = newLastPointUnit;
}
watch(() => draggedPoint.value?.unit, updateLastPointUnit);

onMounted(() => {
    resizeObserver.value = new ResizeObserver(() => {
        height.value = svgEl.value!.clientHeight ?? 0;
    });
    resizeObserver.value.observe(svgEl.value!);
    scrollTicker.value = setInterval(() => scrollTick(), 100);
    updateLastPointUnit();
});

onBeforeUnmount(() => {
    resizeObserver.value?.disconnect();
    if (scrollTicker.value) {
        clearInterval(scrollTicker.value);
        scrollTicker.value = null;
    }
});

function getXCoordinate(unit: number) {
    return unit * unitWidth.value + padding.value;
}

function getUnit(xCoordinate: number) {
    return Math.max(Math.round((xCoordinate - padding.value) / unitWidth.value), 0);
}

function getYCoordinate(value: number) {
    return (1 - value) * (height.value - 2 * padding.value) + padding.value;
}

function getValue(yCoordinate: number) {
    return clamp((-yCoordinate + padding.value) / (height.value - 2 * padding.value) + 1, 0, 1);
}

function mousedown(id: string) {
    draggedPoint.value = points.value.find((p) => p.id === id) ?? null;
}

function mouseup() {
    draggedPoint.value = null;
}

function mousemove(ev: MouseEvent) {
    if (draggedPoint.value) {
        if (draggedPoint.value !== points.value[0]) {
            draggedPoint.value.unit = snap(getUnit(ev.offsetX));
        }
        draggedPoint.value.value = getValue(ev.offsetY);
        props.automationClip.sortPoints();
    }
    updateScrollAmount(ev);
}

function updateScrollAmount(ev: MouseEvent) {
    const offset = ev.offsetX - el.value!.scrollLeft;
    if (offset > el.value!.clientWidth - 15) {
        scrollAmount.value = 30;
    } else if (offset > el.value!.clientWidth - 25) {
        scrollAmount.value = 10;
    } else if (offset < 15) {
        scrollAmount.value = -30;
    } else if (offset < 25) {
        scrollAmount.value = -10;
    } else {
        scrollAmount.value = 0;
    }
}

function scrollTick() {
    if (draggedPoint.value && scrollAmount.value) {
        el.value!.scrollBy(scrollAmount.value, 0);
    }
}

function dblclick(ev: MouseEvent) {
    props.automationClip.addPoint(getUnit(ev.offsetX), getValue(ev.offsetY));
}

function wheel(ev: WheelEvent) {
    const amount = normalizeMouseWheel(ev);
    const unit = getUnit(ev.offsetX); // the unit which is currently hovered
    unitWidth.value *= 1 - amount / 1500;
    // scroll so that the unit stays at the same place visually
    el.value!.scrollBy(getXCoordinate(unit) - ev.offsetX, 0);
}
</script>

<style lang="scss" scoped>
.automation-editor {
    width: 100%;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
}

svg {
    min-width: 100%;
    height: 100%;

    & line {
        stroke: white;
    }

    & circle {
        stroke: darkgray;
        fill: darkgray;
        z-index: 4;
        transition: fill 0.2s linear, stroke 0.2s linear;
    }
    & circle:hover,
    & circle.--dragged {
        stroke: white;
        fill: white;
    }
}

.border {
    stroke: #fffc;
}

.h-grid-line {
    stroke: #fff5;
}

.v-grid-line {
    stroke: #fff5;
}
</style>
