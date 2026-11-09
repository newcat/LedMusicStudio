<template>
    <div class="library-asset-properties">
        <div class="asset">
            <div class="thumb">
                <img v-if="definition && !imageFailed" :src="definition.preview" :alt="definition.name" @error="imageFailed = true" />
                <i v-else class="pi pi-box"></i>
            </div>
            <div class="info">
                <div class="name">{{ definition?.name ?? object.assetId }}</div>
                <div class="size">{{ sizeLabel }}</div>
            </div>
        </div>
        <div v-if="!definition" class="notice">This asset is not available in this version ({{ object.assetId }}).</div>
        <template v-if="definition && isParametric">
            <div class="section-title">Parameters</div>
            <ParameterFields :definition="definition" :params="object.params" @update="setParams" />
        </template>
        <LabelledFormField v-if="variantOptions" label="Variant">
            <Select
                :model-value="variantValue"
                :options="variantOptions"
                option-label="label"
                option-value="value"
                size="small"
                fluid
                aria-label="Variant"
                @update:model-value="setVariant"
            />
        </LabelledFormField>
        <LabelledFormField v-if="showColor" label="Color">
            <div class="color-row">
                <ColorPicker :model-value="effectiveColor.slice(1)" format="hex" aria-label="Color" @update:model-value="setColor" />
                <span class="color-value">{{ object.color ?? "Asset default" }}</span>
                <Button text size="small" label="Reset" :disabled="object.color === null" @click="resetColor" />
            </div>
        </LabelledFormField>
        <Button outlined size="small" label="Replace asset…" icon="pi pi-sync" @click="showPicker = true" />
        <AssetPicker v-model:visible="showPicker" :category="pickerCategory" @pick="replace" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Button from "primevue/button";
import ColorPicker from "primevue/colorpicker";
import Select from "primevue/select";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { assetCatalog } from "@/assetLibrary/catalog";
import { resolveSlotStyle } from "@/assetLibrary/materials";
import type { ParamValues } from "@/assetLibrary/types";
import { useScene } from "../../sceneStore";
import type { LibraryAssetObject } from "../../model/types";
import AssetPicker from "../library/AssetPicker.vue";
import ParameterFields from "./ParameterFields.vue";

const props = defineProps<{
    object: LibraryAssetObject;
}>();

const store = useScene();

const definition = computed(() => assetCatalog.get(props.object.assetId));
const isParametric = computed(() => definition.value?.source.type === "parametric");
const pickerCategory = computed(() => definition.value?.category);
const showPicker = ref(false);
const imageFailed = ref(false);
watch(
    () => props.object.assetId,
    () => (imageFailed.value = false)
);

function format(v: number) {
    return Number(v.toFixed(2)).toString();
}

const sizeLabel = computed(() => {
    const [w, h, d] = props.object.size;
    return `${format(w)} × ${format(h)} × ${format(d)} m`;
});

function setParams(partial: Partial<ParamValues>) {
    store.setAssetParams(props.object.id, partial);
}

/**
 * The Select treats `null` and "" as "nothing selected", so "Default" (`variant: null`) uses this option value
 * instead; it cannot collide with a variant id written in the catalog.
 */
const DEFAULT_VARIANT = "@default";

/** "Default" plus the asset's variants; `null` when the asset has none. */
const variantOptions = computed(() => {
    const variants = definition.value?.variants;
    if (!variants?.length) return null;
    return [{ label: "Default", value: DEFAULT_VARIANT }, ...variants.map((v) => ({ label: v.name, value: v.id }))];
});

const variantValue = computed(() => props.object.variant ?? DEFAULT_VARIANT);

function setVariant(value: string | null) {
    const variant = value && value !== DEFAULT_VARIANT ? value : null;
    if (variant !== props.object.variant) {
        store.setAssetVariant(props.object.id, variant);
    }
}

/** T096: the color picker is offered for non-parametric assets with a `body` slot (parametric ones get it in US7). */
const showColor = computed(() => {
    const def = definition.value;
    return Boolean(def && def.source.type !== "parametric" && def.materialSlots?.includes("body"));
});

/** The color the body slot shows right now: the override, else the variant or default color. */
const effectiveColor = computed(() => {
    const def = definition.value;
    if (props.object.color) return props.object.color;
    if (!def) return "#888888";
    return resolveSlotStyle(def, "body", { variant: props.object.variant, material: props.object.material }).color;
});

function setColor(value: unknown) {
    if (typeof value !== "string" || !/^[0-9a-fA-F]{6}$/.test(value)) return;
    const color = `#${value.toLowerCase()}`;
    if (color !== props.object.color) {
        store.setAssetColor(props.object.id, color);
    }
}

function resetColor() {
    store.setAssetColor(props.object.id, null);
}

function replace(assetId: string) {
    store.replaceAsset(props.object.id, assetId);
}
</script>

<style scoped>
.library-asset-properties {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.asset {
    display: flex;
    gap: 0.75rem;
    align-items: center;
}

.thumb {
    width: 64px;
    height: 64px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
}

.thumb img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.thumb .pi {
    font-size: 2rem;
    opacity: 0.6;
}

.name {
    font-weight: 600;
}

.color-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.color-value {
    flex: 1;
    font-size: 0.85rem;
    opacity: 0.85;
}

.section-title {
    font-weight: 600;
    font-size: 0.85rem;
}

.size,
.notice {
    font-size: 0.85rem;
    opacity: 0.85;
}

.notice {
    color: var(--p-orange-400, #fb923c);
}
</style>
