<template>
    <PropertyRow v-for="row in visibleRows" :key="row.key" :label="row.label">
        <div class="axes">
            <InputNumber
                v-for="axis in [0, 1, 2]"
                :key="axis"
                :model-value="current ? current[row.key][axis] : 0"
                :min="row.min"
                :min-fraction-digits="0"
                :max-fraction-digits="row.digits"
                :step="row.step"
                :disabled="!current"
                show-buttons
                button-layout="stacked"
                size="small"
                fluid
                :aria-label="`${row.label} ${AXIS_NAMES[axis]}`"
                @update:model-value="onInput(row.key, axis, $event)"
                @blur="commit"
                @keydown.enter="commit"
            />
        </div>
    </PropertyRow>
    <PropertyRow v-if="scaleHidden" label="Scale" hint="Size is set by the parameters" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import InputNumber from "primevue/inputnumber";

import PropertyRow from "./PropertyRow.vue";

import { useScene, type ObjectStates } from "../../sceneStore";
import { MIN_SCALE } from "../../model/transformMath";
import { isParametricLibraryAsset } from "../../model/defaults";
import type { Vec3 } from "../../model/types";

type TransformKey = "position" | "rotation" | "scale";

const AXIS_NAMES = ["X", "Y", "Z"];
/** edits that pause for this long are committed even without blur (spinner clicks) */
const IDLE_COMMIT_MS = 800;

const store = useScene();

const rows: Array<{ key: TransformKey; label: string; digits: number; step: number; min?: number }> = [
    { key: "position", label: "Position (m)", digits: 3, step: 0.1 },
    { key: "rotation", label: "Rotation (°)", digits: 1, step: 1 },
    { key: "scale", label: "Scale", digits: 3, step: 0.1, min: MIN_SCALE },
];

/** The active object's values are shown. */
const current = computed(() => (store.activeId ? store.scene.objects[store.activeId] : undefined));
/** Parametric library assets keep scale [1, 1, 1]; their size comes from the parameters (T078). */
const scaleHidden = computed(() => isParametricLibraryAsset(current.value));
const visibleRows = computed(() => (scaleHidden.value ? rows.filter((row) => row.key !== "scale") : rows));

let before: ObjectStates | null = null;
let label = "Edit transform";
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function onInput(key: TransformKey, axis: number, value: number | null) {
    if (value === null || !Number.isFinite(value)) {
        return;
    }
    const ids = store.selection.filter((id) => store.scene.objects[id]);
    if (ids.length === 0) {
        return;
    }
    if (!before) {
        before = store.captureBeforeStates(ids);
        label = key === "position" ? "Move" : key === "rotation" ? "Rotate" : "Scale";
    }
    // the edited component is applied to all selected objects
    const transforms: Record<string, Partial<Record<TransformKey, Vec3>>> = {};
    for (const id of ids) {
        const next = [...store.scene.objects[id][key]] as Vec3;
        next[axis] = key === "scale" ? Math.max(MIN_SCALE, value) : value;
        transforms[id] = { [key]: next };
    }
    store.previewTransforms(transforms);

    clearTimeout(idleTimer);
    idleTimer = setTimeout(commit, IDLE_COMMIT_MS);
}

function commit() {
    clearTimeout(idleTimer);
    if (before) {
        store.commitPreview(before, label);
        before = null;
    }
}

// switching the selection ends the edit of the previous one
watch(() => store.selection.join(","), commit);
onBeforeUnmount(commit);
</script>

<style scoped>
.axes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--insp-gap-1);
}
</style>
