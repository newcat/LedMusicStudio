
<template>
    <div ref="stageViewEl" class="stage-view" @mousemove="showMenu">
        <canvas ref="canvas"></canvas>
        <div v-if="client?.protocolMismatch.value" class="protocol-warning">Please reload the visualization window</div>
        <div v-if="menuVisible" class="top-right">
            <div class="camera-menu">
                <button
                    type="button"
                    class="gear-button"
                    :class="{ open: settingsOpen }"
                    title="Display settings"
                    aria-label="Display settings"
                    :aria-expanded="settingsOpen"
                    @click="settingsOpen = !settingsOpen"
                >
                    ⚙
                </button>
                <button v-for="camera in cameras" :key="camera.id" type="button" @click="applyCamera(camera)">{{ camera.name }}</button>
            </div>
            <div v-if="settingsOpen" class="settings-panel">
                <div class="settings-label">Quality</div>
                <div class="quality-buttons" role="radiogroup" aria-label="Quality">
                    <button
                        v-for="level in QUALITY_OPTIONS"
                        :key="level.value"
                        type="button"
                        role="radio"
                        :aria-checked="preferences.show.quality === level.value"
                        :class="{ selected: preferences.show.quality === level.value }"
                        @click="setQuality(level.value)"
                    >
                        {{ level.label }}
                    </button>
                </div>
                <label class="settings-check">
                    <input type="checkbox" :checked="preferences.show.showFps" @change="setShowFps(($event.target as HTMLInputElement).checked)" />
                    Show frame rate
                </label>
                <label class="settings-check">
                    <input
                        type="checkbox"
                        :checked="preferences.photosensitivityLimit"
                        @change="setFlashLimit(($event.target as HTMLInputElement).checked)"
                    />
                    Limit flash rate
                </label>
                <div class="settings-hint">Limits strobes and flashes to 3 per second (photosensitivity).</div>
                <label class="settings-check" :class="{ disabled: preferences.photosensitivityLimit }">
                    <input
                        type="checkbox"
                        :checked="preferences.showTrueStrobeRate"
                        :disabled="preferences.photosensitivityLimit"
                        @change="setTrueStrobeRate(($event.target as HTMLInputElement).checked)"
                    />
                    Show true strobe rate
                </label>
            </div>
        </div>
        <ViewHud v-if="hudView" :view="hudView" :show-fps="preferences.show.showFps" />
    </div>
</template>

<script setup lang="ts">
import { computed, markRaw, ref, shallowRef, onMounted, onBeforeUnmount, watch } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as THREE from "three";

import type { CameraPose } from "@/scene/model/types";
import type { QualityLevel } from "./quality";
import { SceneView } from "./sceneView";
import { ShowWindowClient } from "./showWindowClient";
import ViewHud from "./ViewHud.vue";
import { flashLimitHz, useViewPreferences, viewPreferences, type ViewPreferences } from "./viewPreferences";

const QUALITY_OPTIONS: Array<{ value: QualityLevel; label: string }> = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
];

const stageViewEl = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const client = ref<ShowWindowClient>();
const menuVisible = ref(false);
/** Gear panel (T075); hidden together with the camera menu. */
const settingsOpen = ref(false);
const cameras = computed(() => client.value?.cameras.value ?? []);

/** User preferences shared with the main window through localStorage and the `storage` event (R16). */
const preferences = useViewPreferences();
const hudView = shallowRef<SceneView | null>(null);

let view: SceneView | undefined;

function applyPreferences(p: ViewPreferences) {
    view?.setQuality(p.show.quality);
    view?.setFlashLimit(flashLimitHz(p));
}

watch(preferences, applyPreferences);

function setQuality(quality: QualityLevel) {
    viewPreferences.update((p) => {
        p.show.quality = quality;
    });
}

function setShowFps(showFps: boolean) {
    viewPreferences.update((p) => {
        p.show.showFps = showFps;
    });
}

function setFlashLimit(limit: boolean) {
    viewPreferences.update({ photosensitivityLimit: limit });
}

function setTrueStrobeRate(show: boolean) {
    viewPreferences.update({ showTrueStrobeRate: show });
}
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

function initialize() {
    if (!stageViewEl.value || !canvas.value) {
        console.warn("stageViewEl or canvas is not set");
        return;
    }

    view = new SceneView(canvas.value, { showEditorProxies: false, kind: "show" });
    applyPreferences(preferences.value);
    hudView.value = markRaw(view);
    view.setActive(document.visibilityState === "visible");
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

/** FR-053: a hidden show window stops rendering and only keeps the latest values. */
function onVisibilityChange() {
    view?.setActive(document.visibilityState === "visible");
}

/** The camera menu and the gear panel hide themselves after 3 s without mouse movement. */
function showMenu() {
    menuVisible.value = true;
    clearTimeout(hideMenuTimeout);
    hideMenuTimeout = setTimeout(() => {
        menuVisible.value = false;
        settingsOpen.value = false;
    }, 3000);
}

function cleanup() {
    clearTimeout(hideMenuTimeout);
    hudView.value = null;
    client.value?.dispose();
    client.value = undefined;
    controls?.dispose();
    controls = undefined;
    view?.dispose();
    view = undefined;
}

onMounted(() => {
    window.addEventListener("pagehide", cleanup);
    document.addEventListener("visibilitychange", onVisibilityChange);
    initialize();
});

onBeforeUnmount(() => {
    window.removeEventListener("pagehide", cleanup);
    document.removeEventListener("visibilitychange", onVisibilityChange);
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

.top-right {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: flex-start;
    flex-direction: row-reverse;
    gap: 0.5rem;
    z-index: 2;
}

.camera-menu {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.gear-button {
    align-self: flex-end;
    font-size: 1rem;
    line-height: 1;
}

.camera-menu button.open,
.quality-buttons button.selected {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.7);
}

.settings-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 16rem;
    padding: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.75);
    color: white;
    font-size: 0.85rem;
}

.settings-label {
    opacity: 0.85;
}

.quality-buttons {
    display: flex;
}

.quality-buttons button {
    flex: 1;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 0.25rem 0.5rem;
    cursor: pointer;
}

.quality-buttons button + button {
    border-left: none;
}

.quality-buttons button:first-child {
    border-radius: 4px 0 0 4px;
}

.quality-buttons button:last-child {
    border-radius: 0 4px 4px 0;
}

.settings-check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
}

.settings-check.disabled {
    opacity: 0.5;
    cursor: default;
}

.settings-hint {
    margin-top: -0.25rem;
    font-size: 0.75rem;
    opacity: 0.7;
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
