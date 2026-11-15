<template>
    <PropertyRow label="Material">
        <Select
            :model-value="material ?? NONE"
            :options="options"
            option-label="label"
            option-value="value"
            size="small"
            fluid
            aria-label="Material"
            @update:model-value="onMaterial"
        >
            <template #option="{ option }">
                <span class="option">
                    <span class="swatch" :style="{ background: option.color ?? 'transparent' }"></span>
                    {{ option.label }}
                </span>
            </template>
        </Select>
    </PropertyRow>
    <PropertyRow label="Color">
        <div class="color-row">
            <ColorPicker :model-value="color.slice(1)" format="hex" aria-label="Color" @update:model-value="onColor" />
            <span class="color-text">{{ color }}</span>
        </div>
    </PropertyRow>
</template>

<script setup lang="ts">
import Select from "primevue/select";
import ColorPicker from "primevue/colorpicker";

import PropertyRow from "./PropertyRow.vue";
import { MATERIAL_PRESETS, isMaterialPresetId } from "@/assetLibrary/materials";
import type { MaterialPresetId } from "@/assetLibrary/types";

defineProps<{
    material: MaterialPresetId | null;
    /** "#rrggbb" */
    color: string;
}>();

const emit = defineEmits<{
    "update:material": [value: MaterialPresetId | null];
    "update:color": [value: string];
}>();

/** The Select treats `null` as "nothing selected", so "None" uses a sentinel value. */
const NONE = "@none";

const options = [
    { label: "None (color only)", value: NONE, color: null as string | null },
    ...Object.values(MATERIAL_PRESETS).map((p) => ({ label: p.name, value: p.id as string, color: p.color as string | null })),
];

function onMaterial(value: string | null) {
    emit("update:material", value && isMaterialPresetId(value) ? value : null);
}

function onColor(value: unknown) {
    if (typeof value === "string" && /^[0-9a-fA-F]{6}$/.test(value)) {
        emit("update:color", `#${value.toLowerCase()}`);
    }
}
</script>

<style scoped>
.color-row {
    display: flex;
    align-items: center;
    gap: var(--insp-gap-2, 8px);
    min-height: 2rem;
}

.color-text {
    font-size: 0.8125rem;
    color: var(--p-text-muted-color);
}

.option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.3);
}
</style>
