<template>
    <div>
        <div class="flex gap-2">
            <Button icon="mdi mdi-plus" text rounded @click="addStop" />
            <Button icon="mdi mdi-minus" text rounded @click="removeStop" />
            <Button icon="mdi mdi-dots-vertical" text rounded @click="ctxMenu?.toggle($event)" />
            <Menu ref="ctxMenu" :model="ctxMenuItems" :popup="true" />
            <Select v-model="modelValue.mode" :options="modes" option-label="label" option-value="value" placeholder="Mode" />
        </div>
        <div ref="colorRampEl" class="color-ramp" @mousedown="selectedStopId = ''">
            <template v-for="stop in modelValue.stops" :key="stop.id">
                <div class="color-stop-indicator" :style="{ left: `${Math.round(100 * stop.position)}%` }"></div>
                <div
                    class="color-stop-handle"
                    :class="{ '--selected': selectedStopId === stop.id }"
                    :style="{ left: `${Math.round(100 * stop.position)}%` }"
                    @mousedown.stop="onHandleMousedown(stop)"
                ></div>
            </template>
        </div>
        <div class="flex gap-2 h-4">
            <ColorPicker v-if="selectedStop" v-model="selectedStop.color" class="w-full" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ComponentInstance, computed, ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import type { InterpolationMode } from "chroma-js";
import Button from "primevue/button";
import Select from "primevue/select";
import Menu from "primevue/menu";
import ColorPicker from "./ColorPicker.vue";
import type { ColorRampStop, ColorRampValue } from "../nodes/colors/ColorRampNode";

const modes: { label: string; value: InterpolationMode }[] = [
    { label: "RGB", value: "rgb" },
    { label: "HSL", value: "hsl" },
];

const ctxMenuItems = [
    { label: "Flip Color Ramp", command: flip },
    { label: "Distribute Stops from Left", command: distributeLeft },
    { label: "Distribute Evenly", command: distributeEvenly },
];

const modelValue = defineModel<ColorRampValue>({ required: true });

const colorRampEl = ref<HTMLElement>();
const ctxMenu = ref<ComponentInstance<typeof Menu>>();
const selectedStopId = ref("");

const selectedStop = computed(() => modelValue.value.stops.find((s) => s.id === selectedStopId.value));

const cssLinearGradient = computed(() => {
    if (modelValue.value.stops.length === 0) {
        return "black";
    } else if (modelValue.value.stops.length === 1) {
        return `rgb(${modelValue.value.stops[0].color[0]}, ${modelValue.value.stops[0].color[1]}, ${modelValue.value.stops[0].color[2]})`;
    }

    const cssColorSpace = {
        rgb: "srgb",
        hsl: "hsl",
    };
    const args: string[] = [`to right in ${cssColorSpace[modelValue.value.mode]}`];
    for (const stop of modelValue.value.stops.toSorted((a, b) => a.position - b.position)) {
        args.push(`rgb(${stop.color[0]}, ${stop.color[1]}, ${stop.color[2]}) ${Math.round(100 * stop.position)}%`);
    }
    return `linear-gradient(${args.join(", ")})`;
});

function addStop() {
    modelValue.value.stops.push({
        id: uuidv4(),
        color: [255 * Math.random(), 255 * Math.random(), 255 * Math.random()],
        position: Math.random(),
    });
}

function removeStop() {
    modelValue.value.stops = modelValue.value.stops.filter((s) => s.id !== selectedStopId.value);
}

function onHandleMousedown(stop: ColorRampStop) {
    selectedStopId.value = stop.id;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
}

function onMouseUp() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
}

function onMouseMove(event: MouseEvent) {
    if (!colorRampEl.value) {
        return;
    }

    const rect = colorRampEl.value.getBoundingClientRect();
    const stop = modelValue.value.stops.find((s) => s.id === selectedStopId.value);
    if (stop) {
        stop.position = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    }
}

function flip() {
    modelValue.value.stops = modelValue.value.stops.map((s) => ({ ...s, position: 1 - s.position }));
}

function distributeLeft() {
    modelValue.value.stops.sort((a, b) => a.position - b.position);
    modelValue.value.stops = modelValue.value.stops.map((s, i) => ({ ...s, position: i / modelValue.value.stops.length }));
}

function distributeEvenly() {
    modelValue.value.stops.sort((a, b) => a.position - b.position);
    modelValue.value.stops = modelValue.value.stops.map((s, i) => ({ ...s, position: i / (modelValue.value.stops.length - 1) }));
}
</script>

<style scoped>
.color-ramp {
    position: relative;
    width: 100%;
    height: 1.75rem;
    background: v-bind(cssLinearGradient);
    border-radius: var(--baklava-control-border-radius);
    margin-top: 1rem;
    margin-bottom: 1rem;
}

.color-stop-handle {
    position: absolute;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    top: 50%;
    background: white;
    border: 1px solid gray;
    transform: translate(-50%, -50%);
    cursor: pointer;
    box-shadow: 0 0 0.25rem 0 rgba(0, 0, 0, 0.25);
}

.color-stop-handle:hover {
    box-shadow: 0 0 0.5rem 0 rgba(0, 0, 0, 0.5);
}

.color-stop-handle.--selected {
    background: var(--baklava-control-color-primary);
}

.color-stop-indicator {
    position: absolute;
    height: 1.75rem;
    top: 0;
    transform: translateX(-0.5px);
    border-left: 1px dashed #0008;
}
</style>
