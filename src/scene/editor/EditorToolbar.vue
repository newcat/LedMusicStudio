<template>
    <div class="editor-toolbar">
        <!-- Create -->
        <Button severity="secondary" size="small" icon="mdi mdi-plus" label="Add" @click="addMenu?.toggle($event)" />
        <Menu ref="addMenu" :model="addItems" popup />
        <ToggleButton
            v-tooltip.bottom="'Draw LED strip'"
            :model-value="overlay?.toolState.value?.mode === 'drawing'"
            :disabled="!overlay"
            size="small"
            aria-label="Draw LED strip"
            class="icon-toggle"
            @update:model-value="$emit('drawStrip')"
        >
            <i class="mdi mdi-led-strip-variant" />
        </ToggleButton>

        <Divider layout="vertical" />

        <!-- Transform -->
        <SelectButton v-model="transformMode" :options="modes" option-label="label" option-value="mode" data-key="mode" :allow-empty="false" size="small" aria-label="Transform mode">
            <template #option="{ option }">
                <i v-tooltip.bottom="`${option.label} (${option.key})`" :class="option.icon" :aria-label="option.label" />
            </template>
        </SelectButton>
        <Button
            v-tooltip.bottom="'Toggle world/local axes (Q)'"
            text
            severity="secondary"
            size="small"
            :icon="settings.transformSpace === 'world' ? 'mdi mdi-earth' : 'mdi mdi-cube-outline'"
            :label="settings.transformSpace === 'world' ? 'World' : 'Local'"
            class="space-toggle"
            @click="store.updateSettings({ transformSpace: settings.transformSpace === 'world' ? 'local' : 'world' })"
        />

        <ButtonGroup>
            <ToggleButton
                v-tooltip.bottom="'Snapping (Shift+S), hold Ctrl while dragging to invert'"
                :model-value="settings.snapEnabled"
                size="small"
                aria-label="Snapping"
                @update:model-value="store.updateSettings({ snapEnabled: $event })"
            >
                <i class="mdi mdi-magnet" />
                <span>Snap</span>
            </ToggleButton>
            <Button v-tooltip.bottom="'Snap steps'" severity="secondary" outlined size="small" :label="snapSummary" class="snap-steps" @click="snapPopover?.toggle($event)" />
        </ButtonGroup>
        <Popover ref="snapPopover">
            <div class="snap-panel">
                <label for="snap-translation">Translation step</label>
                <InputNumber v-model="translationSnap" input-id="snap-translation" :min="0.001" :max-fraction-digits="3" suffix=" m" size="small" fluid />
                <label for="snap-rotation">Rotation step</label>
                <InputNumber v-model="rotationSnap" input-id="snap-rotation" :min="0.1" :max-fraction-digits="1" suffix="°" size="small" fluid />
            </div>
        </Popover>

        <Divider layout="vertical" />

        <!-- View -->
        <ToggleButton
            v-for="toggle in displayToggles"
            :key="toggle.key"
            v-tooltip.bottom="toggle.label"
            :model-value="settings[toggle.key]"
            size="small"
            :aria-label="toggle.label"
            class="icon-toggle"
            @update:model-value="store.updateSettings({ [toggle.key]: $event })"
        >
            <i :class="toggle.icon" />
        </ToggleButton>
        <Button text severity="secondary" size="small" @click="viewMenu?.toggle($event)">
            <i class="mdi mdi-video-3d" />
            <span>View</span>
            <i class="mdi mdi-chevron-down chevron" />
        </Button>
        <Menu ref="viewMenu" :model="viewItems" popup />
        <CameraMenu :get-pose="() => overlay?.getCameraPose() ?? null" @apply="(pose) => overlay?.setCameraPose(pose)" />
        <Button
            v-tooltip.bottom="'Focus selection (F)'"
            text
            severity="secondary"
            size="small"
            icon="mdi mdi-crosshairs-gps"
            aria-label="Focus selection"
            :disabled="!overlay"
            @click="overlay?.focusSelection()"
        />

        <span class="spacer"></span>

        <SceneSettingsMenu />
        <Button
            v-tooltip.bottom="'Arrange selection'"
            text
            severity="secondary"
            size="small"
            icon="mdi mdi-align-horizontal-center"
            aria-label="Arrange selection"
            :disabled="store.selection.length < 2"
            @click="arrangeMenu?.toggle($event)"
        />
        <TieredMenu ref="arrangeMenu" :model="arrangeItems" popup />

        <Divider layout="vertical" />

        <Button v-tooltip.bottom="'Undo (Ctrl+Z)'" text severity="secondary" size="small" icon="mdi mdi-undo" aria-label="Undo" :disabled="!store.canUndo" @click="$emit('undo')" />
        <Button v-tooltip.bottom="'Redo (Ctrl+Y)'" text severity="secondary" size="small" icon="mdi mdi-redo" aria-label="Redo" :disabled="!store.canRedo" @click="$emit('redo')" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import ButtonGroup from "primevue/buttongroup";
import Divider from "primevue/divider";
import InputNumber from "primevue/inputnumber";
import Menu from "primevue/menu";
import Popover from "primevue/popover";
import SelectButton from "primevue/selectbutton";
import TieredMenu from "primevue/tieredmenu";
import ToggleButton from "primevue/togglebutton";
import type { MenuItem } from "primevue/menuitem";

import { useScene, type TransformMode } from "../sceneStore";
import type { EditorOverlay, ViewPreset } from "./editorOverlay";
import CameraMenu from "./CameraMenu.vue";
import SceneSettingsMenu from "./SceneSettingsMenu.vue";

import { addMenuItems, type AddKind } from "./addMenu";

export type { AddKind };

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
const snapPopover = ref<InstanceType<typeof Popover>>();

const modes: Array<{ mode: TransformMode; label: string; key: string; icon: string }> = [
    { mode: "translate", label: "Move", key: "W", icon: "mdi mdi-cursor-move" },
    { mode: "rotate", label: "Rotate", key: "E", icon: "mdi mdi-rotate-3d-variant" },
    { mode: "scale", label: "Scale", key: "R", icon: "mdi mdi-resize" },
];

const transformMode = computed({
    get: () => store.transformMode,
    set: (mode: TransformMode) => {
        store.transformMode = mode;
    },
});

/** Grid, axes and labels are scene editor settings (stored in the scene). */
const displayToggles: Array<{ key: "showGrid" | "showAxes" | "showLabels"; label: string; icon: string }> = [
    { key: "showGrid", label: "Grid", icon: "mdi mdi-grid" },
    { key: "showAxes", label: "Axes", icon: "mdi mdi-axis-arrow" },
    { key: "showLabels", label: "Labels", icon: "mdi mdi-label-outline" },
];

const snapSummary = computed(() => `${settings.value.translationSnap} m · ${settings.value.rotationSnap}°`);

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

const addItems = addMenuItems((kind) => emit("add", kind));

function viewItem(label: string, key: string, preset: ViewPreset): MenuItem {
    return { label: `${label} (${key})`, command: () => props.overlay?.setView(preset) };
}

const viewItems = computed<MenuItem[]>(() => [
    viewItem("Perspective", "5", "perspective"),
    viewItem("Top", "7", "top"),
    viewItem("Front", "1", "front"),
    viewItem("Side", "3", "side"),
    { separator: true },
    { label: "Focus selection (F)", icon: "mdi mdi-crosshairs-gps", disabled: !props.overlay, command: () => props.overlay?.focusSelection() },
]);

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
    gap: 0.375rem;
    min-height: 3rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.editor-toolbar :deep(.p-divider-vertical) {
    align-self: center;
    height: 1.25rem;
    min-height: 0;
    margin: 0 0.25rem;
    padding: 0;
}

.spacer {
    flex: 1;
}

.icon-toggle :deep(.p-togglebutton-content) {
    padding-inline: 0.375rem;
}

.space-toggle {
    min-width: 5rem;
}

.snap-steps {
    font-variant-numeric: tabular-nums;
    color: var(--p-text-muted-color);
}

.chevron {
    font-size: 0.75rem;
    opacity: 0.7;
}

.snap-panel {
    display: grid;
    grid-template-columns: auto 8rem;
    align-items: center;
    gap: 0.5rem 0.75rem;
    font-size: 0.875rem;
}
</style>
