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
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { useResizeObserver, useThrottleFn } from "@vueuse/core";

import { SceneView } from "@/visualization/sceneView";
import { modelLibrary } from "@/visualization/modelLibrary";
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

let view: SceneView | undefined;
let unregisterSink: (() => void) | undefined;
let unmounted = false;

const throttledResize = useThrottleFn(() => onResize(), 100, true);
useResizeObserver(container, () => void throttledResize());

function onResize() {
    if (!container.value) {
        return;
    }
    overlay.value?.resize(container.value.clientWidth, container.value.clientHeight);
}

onMounted(async () => {
    if (!canvas.value || !container.value) {
        return;
    }
    // renderers of moving heads need the model library (idempotent)
    await modelLibrary.initialize();
    if (unmounted || !canvas.value || !container.value) {
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
    unmounted = true;
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
</style>
