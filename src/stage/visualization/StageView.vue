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
useResizeObserver(stageViewEl, useThrottleFn(onResize, 100, true));

function initialize() {
    if (!stageViewEl.value) {
        console.warn("stageViewEl is not set");
        return;
    }
    if (!canvas.value) {
        console.warn("canvas is not set");
        return;
    }

    const offscreenCanvas = canvas.value.transferControlToOffscreen();
    stage.renderer.setCanvas(Comlink.transfer(offscreenCanvas, [offscreenCanvas]));
}

function onResize() {
    if (!stageViewEl.value) {
        return;
    }

    stage.renderer.setCanvasSize(stageViewEl.value.clientWidth, stageViewEl.value.clientHeight);
}

watch(
    () => props.active,
    (active) => {
        stage.renderer.setActive(active);
    }
);

onMounted(() => {
    initialize();
    onResize();
});

onBeforeUnmount(() => {
    stage.renderer.setCanvas(null);
});
</script>

<style scoped>
.stage-view {
    width: 100%;
    height: 100%;
    position: relative;
}
</style>
