<template>
    <div class="imported-model-properties">
        <div v-if="asset" class="info">
            <div>File: {{ asset.name }}</div>
            <div>Size: {{ sizeLabel }}</div>
        </div>
        <div v-else class="info">The model data is missing.</div>
        <Button outlined label="Restore original scale" icon="mdi mdi-arrow-expand-all" @click="restoreScale" />
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Button from "primevue/button";

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
.imported-model-properties {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.info {
    font-size: 0.85rem;
    opacity: 0.85;
}
</style>
