<template>
    <div class="marker-label" :class="classes" :style="styles">{{ label }}</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { TICKS_PER_BEAT } from "@/constants";
import { IMarker } from "../types";

const props = defineProps({
    marker: { type: Object as () => IMarker, required: true },
});

const classes = computed(() => {
    return {
        "--major": props.marker.type === "major",
        "--minor": props.marker.type === "minor",
    };
});

const styles = computed(() => {
    return {
        transform: `translate(${props.marker.position}px, -50%) translateX(-50%)`,
    };
});

const label = computed(() => {
    const value = props.marker.unit / (TICKS_PER_BEAT * 4);
    return Number.isInteger(value) ? value.toString() : "";
});
</script>
