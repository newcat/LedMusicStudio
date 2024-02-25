<template>
    <div>
        <div class="flex gap-2">
            <Button icon="mdi mdi-plus" text rounded @click="addStop" />
            <Button icon="mdi mdi-minus" text rounded @click="removeStop" />
            <Button icon="mdi mdi-dots-vertical" text rounded />
            <Dropdown v-model="modelValue.mode" :options="modes" placeholder="Mode" />
        </div>
        <div class="color-ramp" ref="colorRampEl">
            <template v-for="stop in modelValue.stops" :key="stop.id">
                <div class="color-stop-indicator" :style="{ left: `${Math.round(100 * stop.position)}%` }"></div>
                <div
                    class="color-stop-handle"
                    :class="{ '--selected': selectedStopId === stop.id }"
                    :style="{ left: `${Math.round(100 * stop.position)}%` }"
                    @mousedown="onHandleMousedown(stop)"
                ></div>
            </template>
        </div>
        <div class="flex gap-2 h-4">
            <ColorPicker class="w-full" v-if="selectedStop" v-model="selectedStop.color" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import Button from "primevue/button";
import Dropdown from "primevue/dropdown";
import ColorPicker from "./ColorPicker.vue";
import type { ColorRampStop, ColorRampValue } from "../nodes/colors/ColorRampNode";

const modes = ["RGB", "HSV", "HSL"];

const modelValue = defineModel<ColorRampValue>({ required: true });

const colorRampEl = ref<HTMLElement>();
const selectedStopId = ref("");

const selectedStop = computed(() => modelValue.value.stops.find((s) => s.id === selectedStopId.value));

const cssLinearGradient = computed(() => {
    if (modelValue.value.stops.length === 0) {
        return "black";
    } else if (modelValue.value.stops.length === 1) {
        return `rgb(${modelValue.value.stops[0].color[0]}, ${modelValue.value.stops[0].color[1]}, ${modelValue.value.stops[0].color[2]})`;
    }

    const args: string[] = ["to right"];
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
