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
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";

import { SceneView } from "@/visualization/sceneView";
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

let view: SceneView | undefined;
let unregisterSink: (() => void) | undefined;

const throttledResize = useThrottleFn(() => onResize(), 100, true);
useResizeObserver(container, () => void throttledResize());

function onResize() {
    if (!container.value) {
        return;
    }
    overlay.value?.resize(container.value.clientWidth, container.value.clientHeight);
}

onMounted(() => {
    if (!canvas.value || !container.value) {
        return;
    }
    view = new SceneView(canvas.value, { showEditorProxies: true });
    unregisterSink = store.registerSink(new LocalSceneSink(view));
    const editorOverlay = new EditorOverlay(view, container.value, store);
    editorOverlay.onContextMenu = (event) => emit("contextmenu", event);
    overlay.value = editorOverlay;
    onResize();
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
    unregisterSink?.();
    overlay.value?.dispose();
    overlay.value = null;
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
