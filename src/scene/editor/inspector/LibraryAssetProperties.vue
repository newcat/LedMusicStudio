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
        <Button outlined size="small" label="Replace asset…" icon="pi pi-sync" @click="showPicker = true" />
        <AssetPicker v-model:visible="showPicker" :category="pickerCategory" @pick="replace" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Button from "primevue/button";

import { assetCatalog } from "@/assetLibrary/catalog";
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
