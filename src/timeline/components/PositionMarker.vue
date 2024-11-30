<template>
    <div class="position-marker" :style="styles"></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGlobalState } from "@/globalState";
import { useTimeline } from "../model";

const globalState = useGlobalState();
const timeline = useTimeline();

const styles = computed(() => ({
    transform: `translateX(${globalState.position * timeline.unitWidth + timeline.headerWidth}px)`,
}));
</script>

<style scoped>
.position-marker {
    position: absolute;
    height: 100%;
    width: 2px;
    background-color: var(--p-primary-color);
    z-index: 5;
}

.position-marker::before {
    --arrowSize: 6px;

    content: "";
    position: absolute;
    width: 0;
    height: 0;
    top: 0;
    transform: translateX(calc(-50% + 1px));
    border-left: var(--arrowSize) solid transparent;
    border-right: var(--arrowSize) solid transparent;
    border-top: var(--arrowSize) solid var(--p-primary-color);
}
</style>
