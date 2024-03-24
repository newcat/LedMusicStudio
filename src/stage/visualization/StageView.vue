<template>
    <div ref="stageViewEl" class="stage-view">
        <div v-if="!stage.visualization.isSceneLoaded" class="flex h-full items-center justify-center">
            <h2>No scene loaded</h2>
        </div>
        <canvas ref="canvas"></canvas>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";
import * as Comlink from "comlink";
import { useStage } from "../stage";

const props = defineProps<{ active: boolean }>();

const stage = useStage();

const stageViewEl = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const throttledResize = useThrottleFn(() => void onResize(), 100, true);
useResizeObserver(stageViewEl, () => void throttledResize());

async function initialize() {
    if (!stageViewEl.value) {
        console.warn("stageViewEl is not set");
        return;
    }
    if (!canvas.value) {
        console.warn("canvas is not set");
        return;
    }

    const offscreenCanvas = canvas.value.transferControlToOffscreen();
    await stage.renderer.setCanvas(Comlink.transfer(offscreenCanvas, [offscreenCanvas]));
}

async function onResize() {
    if (!stageViewEl.value) {
        return;
    }

    await stage.renderer.setCanvasSize(stageViewEl.value.clientWidth, stageViewEl.value.clientHeight);
}

watch(
    () => props.active,
    async (active) => {
        await stage.renderer.setActive(active);
    }
);

onMounted(async () => {
    await initialize();
    await onResize();
});

onBeforeUnmount(async () => {
    await stage.renderer.setCanvas(null);
});
</script>

<style scoped>
.stage-view {
    width: 100%;
    height: 100%;
    position: relative;
}
</style>
