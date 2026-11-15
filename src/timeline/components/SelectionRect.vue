<template>
    <div class="selection-rect" :style="{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` }"></div>
</template>

<script setup lang="ts">
/** Box-select rectangle in `.content` pixels (feature 005, R9). */
defineProps<{ x: number; y: number; width: number; height: number }>();
</script>

<style scoped>
.selection-rect {
    position: absolute;
    border: 1px solid var(--p-primary-color);
    background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
    pointer-events: none;
    z-index: 7;
}
</style>
