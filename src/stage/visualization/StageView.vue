<template>
    <div ref="stageViewEl" class="stage-view">
        <div v-if="!stage.visualization.scene" class="flex h-full items-center justify-center">
            <h2>No scene loaded</h2>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";
import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { useStage } from "../stage";

const stage = useStage();

const stageViewEl = ref<HTMLElement>();
useResizeObserver(stageViewEl, useThrottleFn(onResize, 100, true));

let continueAnimation = true;
let stats: Stats;
let renderer: THREE.WebGLRenderer;

function initialize() {
    if (!stageViewEl.value) {
        console.warn("stageViewEl is not set");
        return;
    }

    stats = new Stats();
    const statsEl = stats.dom;
    statsEl.style.position = "absolute";
    stageViewEl.value.appendChild(statsEl);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    stageViewEl.value.appendChild(renderer.domElement);
}

function onResize() {
    if (!stageViewEl.value || !renderer) {
        return;
    }

    renderer.setSize(stageViewEl.value.clientWidth, stageViewEl.value.clientHeight);
}

function render() {
    if (continueAnimation) {
        requestAnimationFrame(render);
    }
    if (!stage.visualization.scene || !stage.visualization.camera) {
        return;
    }

    stats.begin();
    renderer.render(stage.visualization.scene, stage.visualization.camera);
    stats.end();
}

onMounted(() => {
    initialize();
    onResize();
    render();
});

onBeforeUnmount(() => {
    continueAnimation = false;
    renderer.dispose();
});
</script>

<style scoped>
.stage-view {
    width: 100%;
    height: 100%;
    position: relative;
}
</style>
