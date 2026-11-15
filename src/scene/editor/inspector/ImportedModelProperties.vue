<template>
    <template v-if="asset">
        <PropertyRow label="File">
            <span class="value-text" :title="asset.name">{{ asset.name }}</span>
        </PropertyRow>
        <PropertyRow label="Size">
            <span class="value-text">{{ sizeLabel }}</span>
        </PropertyRow>
    </template>
    <PropertyRow v-else label="File" warning="The model data is missing." />
    <PropertyRow label="Scale">
        <Button outlined size="small" fluid severity="secondary" label="Restore original" icon="mdi mdi-arrow-expand-all" @click="restoreScale" />
    </PropertyRow>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Button from "primevue/button";

import PropertyRow from "./PropertyRow.vue";

import { useScene } from "../../sceneStore";
import type { ImportedModelObject } from "../../model/types";

const props = defineProps<{
    object: ImportedModelObject;
}>();

const store = useScene();

const asset = computed(() => store.scene.assets[props.object.assetId]);

const sizeLabel = computed(() => {
    const bytes = asset.value?.data.byteLength ?? 0;
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
});

function restoreScale() {
    store.updateObjects({ [props.object.id]: { scale: [...props.object.originalScale] } as Partial<ImportedModelObject> }, "Restore original scale");
}
</script>

<style scoped>
.value-text {
    display: block;
    font-size: 0.875rem;
    line-height: 2rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
