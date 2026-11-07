
<template>
    <div ref="stageViewEl" class="stage-view" @mousemove="showMenu">
        <canvas ref="canvas"></canvas>
        <div v-if="client?.protocolMismatch.value" class="protocol-warning">Please reload the visualization window</div>
        <div v-if="menuVisible && cameras.length > 0" class="camera-menu">
            <button v-for="camera in cameras" :key="camera.id" type="button" @click="applyCamera(camera)">{{ camera.name }}</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as THREE from "three";

import type { CameraPose } from "@/scene/model/types";
import { SceneView } from "./sceneView";
import { ShowWindowClient } from "./showWindowClient";
import { modelLibrary } from "./modelLibrary";

const stageViewEl = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const client = ref<ShowWindowClient>();
const menuVisible = ref(false);
const cameras = computed(() => client.value?.cameras.value ?? []);

let view: SceneView | undefined;
let controls: OrbitControls | undefined;
let hideMenuTimeout: ReturnType<typeof setTimeout> | undefined;

const throttledResize = useThrottleFn(() => onResize(), 100, true);
useResizeObserver(stageViewEl, () => void throttledResize());

function applyCamera(pose: CameraPose) {
    if (!view || !controls) {
        return;
    }
    view.setCameraPose(pose);
    controls.target.set(...pose.target);
    controls.update();
}

async function initialize() {
    if (!stageViewEl.value || !canvas.value) {
        console.warn("stageViewEl or canvas is not set");
        return;
    }

    await modelLibrary.initialize();

    view = new SceneView(canvas.value, { showEditorProxies: false });
    controls = new OrbitControls(view.camera, canvas.value);
    controls.enableDamping = false;
    controls.zoomToCursor = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    view.onBeforeRender(() => controls?.update());

    const showWindowClient = new ShowWindowClient(view, applyCamera);
    client.value = showWindowClient;
    onResize();
    showWindowClient.start();
}

function onResize() {
    if (!stageViewEl.value || !view) {
        return;
    }

    view.resize(stageViewEl.value.clientWidth, stageViewEl.value.clientHeight);
}

/** The camera menu hides itself after 3 s without mouse movement. */
function showMenu() {
    menuVisible.value = true;
    clearTimeout(hideMenuTimeout);
    hideMenuTimeout = setTimeout(() => (menuVisible.value = false), 3000);
}

function cleanup() {
    clearTimeout(hideMenuTimeout);
    client.value?.dispose();
    client.value = undefined;
    controls?.dispose();
    controls = undefined;
    view?.dispose();
    view = undefined;
}

onMounted(async () => {
    window.addEventListener("pagehide", cleanup);
    await initialize();
});

onBeforeUnmount(() => {
    window.removeEventListener("pagehide", cleanup);
    cleanup();
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

.stage-view {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.protocol-warning {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    text-shadow: 0 0 10px black;
}

.camera-menu {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.camera-menu button {
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    padding: 0.25rem 0.75rem;
    cursor: pointer;
    text-align: left;
}

.camera-menu button:hover {
    background: rgba(255, 255, 255, 0.2);
}
</style>
