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
