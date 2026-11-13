<template>
    <div class="editor-toolbar">
        <Button outlined size="small" icon="mdi mdi-plus" label="Add" @click="addMenu?.toggle($event)" />
        <Menu ref="addMenu" :model="addItems" popup />
        <Button
            v-tooltip.bottom="'Draw LED strip'"
            size="small"
            icon="mdi mdi-led-strip-variant"
            aria-label="Draw LED strip"
            :outlined="overlay?.toolState.value?.mode !== 'drawing'"
            :disabled="!overlay"
            @click="$emit('drawStrip')"
        />

        <span class="separator"></span>
        <Button
            v-for="mode in modes"
            :key="mode.mode"
            v-tooltip.bottom="`${mode.label} (${mode.key})`"
            size="small"
            :icon="mode.icon"
            :outlined="store.transformMode !== mode.mode"
            :aria-label="mode.label"
            @click="store.transformMode = mode.mode"
        />
        <Button
            v-tooltip.bottom="'Toggle world/local axes (Q)'"
            size="small"
            outlined
            :label="settings.transformSpace === 'world' ? 'World' : 'Local'"
            @click="store.updateSettings({ transformSpace: settings.transformSpace === 'world' ? 'local' : 'world' })"
        />

        <span class="separator"></span>
        <Button
            v-tooltip.bottom="'Snapping (Shift+S), hold Ctrl while dragging to invert'"
            size="small"
            icon="mdi mdi-magnet"
            label="Snap"
            :outlined="!settings.snapEnabled"
            @click="store.updateSettings({ snapEnabled: !settings.snapEnabled })"
        />
        <InputNumber
            v-model="translationSnap"
            v-tooltip.bottom="'Translation step (m)'"
            :min="0.001"
            :max-fraction-digits="3"
            suffix=" m"
            size="small"
            class="snap-input"
        />
        <InputNumber v-model="rotationSnap" v-tooltip.bottom="'Rotation step (°)'" :min="0.1" :max-fraction-digits="1" suffix="°" size="small" class="snap-input" />

        <span class="separator"></span>
        <Button size="small" icon="mdi mdi-grid" label="Grid" :outlined="!settings.showGrid" @click="store.updateSettings({ showGrid: !settings.showGrid })" />
        <Button size="small" icon="mdi mdi-axis-arrow" label="Axes" :outlined="!settings.showAxes" @click="store.updateSettings({ showAxes: !settings.showAxes })" />
        <Button
            size="small"
            icon="mdi mdi-label-outline"
            label="Labels"
            :outlined="!settings.showLabels"
            @click="store.updateSettings({ showLabels: !settings.showLabels })"
        />

        <span class="separator"></span>
        <Button outlined size="small" icon="mdi mdi-video-3d" label="View" @click="viewMenu?.toggle($event)" />
        <Menu ref="viewMenu" :model="viewItems" popup />
        <Button v-tooltip.bottom="'Focus selection (F)'" outlined size="small" icon="mdi mdi-crosshairs-gps" label="Focus" :disabled="!overlay" @click="overlay?.focusSelection()" />
        <CameraMenu :get-pose="() => overlay?.getCameraPose() ?? null" @apply="(pose) => overlay?.setCameraPose(pose)" />

        <span class="separator"></span>
        <EnvironmentPopover />

        <span class="separator"></span>
        <Button outlined size="small" icon="mdi mdi-align-horizontal-center" label="Arrange" :disabled="store.selection.length < 2" @click="arrangeMenu?.toggle($event)" />
        <TieredMenu ref="arrangeMenu" :model="arrangeItems" popup />

        <span class="spacer"></span>
        <Button v-tooltip.bottom="'Undo (Ctrl+Z)'" text size="small" icon="mdi mdi-undo" aria-label="Undo" :disabled="!store.canUndo" @click="$emit('undo')" />
        <Button v-tooltip.bottom="'Redo (Ctrl+Y)'" text size="small" icon="mdi mdi-redo" aria-label="Redo" :disabled="!store.canRedo" @click="$emit('redo')" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import Menu from "primevue/menu";
import TieredMenu from "primevue/tieredmenu";
import type { MenuItem } from "primevue/menuitem";

import { useScene, type TransformMode } from "../sceneStore";
import type { EditorOverlay, ViewPreset } from "./editorOverlay";
import CameraMenu from "./CameraMenu.vue";
import EnvironmentPopover from "./EnvironmentPopover.vue";

export type AddKind = "box" | "cylinder" | "plane" | "sphere" | "group" | "fixture" | "model";

const props = defineProps<{
    overlay: EditorOverlay | null;
}>();

const emit = defineEmits<{
    add: [kind: AddKind];
    drawStrip: [];
    undo: [];
    redo: [];
}>();

const store = useScene();
const settings = computed(() => store.scene.settings);

const addMenu = ref<InstanceType<typeof Menu>>();
const viewMenu = ref<InstanceType<typeof Menu>>();
const arrangeMenu = ref<InstanceType<typeof TieredMenu>>();

const modes: Array<{ mode: TransformMode; label: string; key: string; icon: string }> = [
    { mode: "translate", label: "Move", key: "W", icon: "mdi mdi-cursor-move" },
    { mode: "rotate", label: "Rotate", key: "E", icon: "mdi mdi-rotate-3d-variant" },
    { mode: "scale", label: "Scale", key: "R", icon: "mdi mdi-resize" },
];

const translationSnap = computed({
    get: () => settings.value.translationSnap,
    set: (value: number | null) => {
        if (value && value > 0) store.updateSettings({ translationSnap: value });
    },
});
const rotationSnap = computed({
    get: () => settings.value.rotationSnap,
    set: (value: number | null) => {
        if (value && value > 0) store.updateSettings({ rotationSnap: value });
    },
});

const addItems: MenuItem[] = [
    { label: "Box", icon: "mdi mdi-cube-outline", command: () => emit("add", "box") },
    { label: "Cylinder", icon: "mdi mdi-cylinder", command: () => emit("add", "cylinder") },
    { label: "Plane", icon: "mdi mdi-square-outline", command: () => emit("add", "plane") },
    { label: "Sphere", icon: "mdi mdi-circle-outline", command: () => emit("add", "sphere") },
    { label: "Group", icon: "mdi mdi-folder-outline", command: () => emit("add", "group") },
    { separator: true },
    { label: "Fixture visualization…", icon: "mdi mdi-lightbulb-on-outline", command: () => emit("add", "fixture") },
    { label: "Import model (GLB)…", icon: "mdi mdi-shape-outline", command: () => emit("add", "model") },
];

function viewItem(label: string, key: string, preset: ViewPreset): MenuItem {
    return { label: `${label} (${key})`, command: () => props.overlay?.setView(preset) };
}

const viewItems: MenuItem[] = [
    viewItem("Perspective", "5", "perspective"),
    viewItem("Top", "7", "top"),
    viewItem("Front", "1", "front"),
    viewItem("Side", "3", "side"),
];

const arrangeItems = computed<MenuItem[]>(() => [
    {
        label: "Align to active",
        disabled: store.selection.length < 2,
        items: (["x", "y", "z"] as const).map((axis) => ({ label: axis.toUpperCase(), command: () => store.alignSelection(axis) })),
    },
    {
        label: "Distribute evenly",
        disabled: store.selection.length < 3,
        items: (["x", "y", "z"] as const).map((axis) => ({ label: axis.toUpperCase(), command: () => store.distributeSelection(axis) })),
    },
]);
</script>

<style scoped>
.editor-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem;
}

.separator {
    width: 1px;
    align-self: stretch;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 0.2rem;
}

.spacer {
    flex: 1;
}

.snap-input {
    width: 6rem;
}

.snap-input :deep(input) {
    width: 100%;
}
</style>
