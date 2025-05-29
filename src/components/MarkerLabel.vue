<template>
    <div class="marker-label" :class="classes" :style="styles">{{ label }}</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { TICKS_PER_BEAT } from "@/constants";
import { IMarker } from "@/utils";

const props = defineProps<{
    marker: IMarker;
}>();

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

<style scoped>
.marker-label {
    position: absolute;
    top: 50%;
    left: 0;
    font-size: 0.7rem;
    pointer-events: none;
}

.marker-label.--major {
    color: var(--p-text-color);
}

.marker-label.--minor {
    color: var(--p-text-muted-color);
}
</style>
