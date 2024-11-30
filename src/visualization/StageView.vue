<template>
    <div ref="stageViewEl" class="stage-view">
        <div v-if="!sceneLoaded" class="no-scene-warning">No scene loaded</div>
        <canvas ref="canvas"></canvas>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";
import * as Comlink from "comlink";
import { StageRenderer } from "./stageRenderer";
import { modelLibrary } from "./modelLibrary";

const stageViewEl = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const sceneLoaded = ref(false);

let renderer: StageRenderer | undefined;

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

    await modelLibrary.initialize();

    renderer = new StageRenderer(sceneLoaded, canvas.value);
    const bc = new BroadcastChannel("visualization");
    Comlink.expose(renderer, bc);
}

function onResize() {
    if (!stageViewEl.value || !renderer) {
        return;
    }

    renderer.setCanvasSize(stageViewEl.value.clientWidth, stageViewEl.value.clientHeight);
}

onMounted(async () => {
    await initialize();
    onResize();
});

onBeforeUnmount(() => {
    renderer?.reset();
});
</script>

<style>
html,
body,
#app {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background: black;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

.no-scene-warning {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    text-shadow: 0 0 10px black;
}

.stage-view {
    width: 100%;
    height: 100%;
    overflow: hidden;
}
</style>
