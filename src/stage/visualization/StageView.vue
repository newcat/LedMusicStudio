<template>
    <div ref="stageViewEl" class="stage-view"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";
import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";

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
    // TODO
    /*
    stats.begin();
    renderer.render(props.stage.scene.scene, props.stage.scene.camera);
    stats.end();
    */
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
