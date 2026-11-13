<template>
    <div
        ref="container"
        class="scene-viewport"
        tabindex="0"
        @mouseenter="hovered = true"
        @mouseleave="hovered = false"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
    >
        <canvas ref="canvas"></canvas>
        <div v-if="snapHint" class="snap-hint">{{ snapHint }}</div>
        <ViewHud v-if="hudView" :view="hudView" :show-fps="preferences.editor.showFps" />
    </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";

import { SceneView } from "@/visualization/sceneView";
import ViewHud from "@/visualization/ViewHud.vue";
import { flashLimitHz, useViewPreferences, type ViewPreferences } from "@/visualization/viewPreferences";
import { LocalSceneSink } from "../sceneSink";
import { useScene } from "../sceneStore";
import { EditorOverlay } from "./editorOverlay";

const emit = defineEmits<{
    contextmenu: [MouseEvent];
}>();

const store = useScene();

const container = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const hovered = ref(false);
const overlay = shallowRef<EditorOverlay | null>(null);

/** Status hint of the active mount/connection snap candidate (feature 002, T084). */
const snapHint = computed(() => overlay.value?.snapHint.value ?? null);

/** User preferences (quality, FPS overlay, flash limit), shared with the show window via localStorage (T075). */
const preferences = useViewPreferences();

let view: SceneView | undefined;
/** The view for the HUD; set once the view exists. */
const hudView = shallowRef<SceneView | null>(null);

function applyPreferences(p: ViewPreferences) {
    view?.setQuality(p.editor.quality);
    view?.setFlashLimit(flashLimitHz(p));
}

watch(preferences, applyPreferences);

let unregisterSink: (() => void) | undefined;
let intersectionObserver: IntersectionObserver | undefined;
/** Last IntersectionObserver result for the container. */
let intersecting = false;

const throttledResize = useThrottleFn(() => onResize(), 100, true);
useResizeObserver(container, () => {
    updateActive();
    void throttledResize();
});

function onResize() {
    if (!container.value) {
        return;
    }
    overlay.value?.resize(container.value.clientWidth, container.value.clientHeight);
}

/**
 * FR-053: the view only renders while it can be seen. This also covers the Programming tab, which hides the editor
 * with `v-show`.
 */
function updateActive() {
    const el = container.value;
    if (!view || !el) {
        return;
    }
    view.setActive(el.clientWidth > 0 && el.clientHeight > 0 && intersecting && document.visibilityState === "visible");
}

onMounted(() => {
    if (!canvas.value || !container.value) {
        return;
    }
    view = new SceneView(canvas.value, { showEditorProxies: true, kind: "editor" });
    applyPreferences(preferences.value);
    hudView.value = markRaw(view);
    intersectionObserver = new IntersectionObserver((records) => {
        const record = records[records.length - 1];
        if (record) {
            intersecting = record.isIntersecting;
            updateActive();
        }
    });
    intersectionObserver.observe(container.value);
    document.addEventListener("visibilitychange", updateActive);
    unregisterSink = store.registerSink(new LocalSceneSink(view));
    const editorOverlay = new EditorOverlay(view, container.value, store);
    editorOverlay.onContextMenu = (event) => emit("contextmenu", event);
    overlay.value = editorOverlay;
    onResize();
    updateActive();
});

// feature 002: drag & drop of library assets
function onDragOver(event: DragEvent) {
    overlay.value?.assetDrop.dragOver(event);
}

function onDragLeave(event: DragEvent) {
    // moving between child elements of the viewport also fires dragleave
    const next = event.relatedTarget as Node | null;
    if (next && container.value?.contains(next)) {
        return;
    }
    overlay.value?.assetDrop.dragLeave();
}

function onDrop(event: DragEvent) {
    overlay.value?.assetDrop.drop(event);
    container.value?.focus();
}

// FR-062: everything is released when the tab is left or the project is replaced
onBeforeUnmount(() => {
    intersectionObserver?.disconnect();
    intersectionObserver = undefined;
    document.removeEventListener("visibilitychange", updateActive);
    unregisterSink?.();
    overlay.value?.dispose();
    overlay.value = null;
    hudView.value = null;
    view?.dispose();
    view = undefined;
});

defineExpose({ overlay, hovered });
</script>

<style scoped>
.scene-viewport {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: black;
    outline: none;
}

canvas {
    display: block;
}

.snap-hint {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    padding: 3px 10px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.7);
    color: #00e5ff;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
}
</style>
