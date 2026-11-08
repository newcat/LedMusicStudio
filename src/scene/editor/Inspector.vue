<template>
    <div class="inspector">
        <div v-if="!active" class="empty">Nothing selected</div>
        <template v-else>
            <div class="header">
                <InputText v-model="nameDraft" size="small" class="name" aria-label="Name" @blur="commitName" @keydown.enter="commitName" />
                <Chip :label="kindLabel" />
            </div>
            <div v-if="store.selection.length > 1" class="multi">{{ store.selection.length }} objects selected, edits apply to all</div>

            <TransformFields />

            <template v-if="store.selection.length === 1">
                <Divider />
                <ShapeProperties v-if="isShape(active)" :object="active" />
                <FixtureVisualizationProperties v-else-if="isFixtureVisualization(active)" :object="active" />
                <ImportedModelProperties v-else-if="isImportedModel(active)" :object="active" />
                <LibraryAssetProperties v-else-if="isLibraryAsset(active)" :object="active" />
                <div v-else-if="!isKnownKind(active.kind)" class="hint">Created by a newer version – only transform can be edited</div>
            </template>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InputText from "primevue/inputtext";
import Chip from "primevue/chip";
import Divider from "primevue/divider";

import { useScene } from "../sceneStore";
import { isFixtureVisualization, isImportedModel, isKnownKind, isLibraryAsset, isShape } from "../model/types";
import TransformFields from "./inspector/TransformFields.vue";
import ShapeProperties from "./inspector/ShapeProperties.vue";
import FixtureVisualizationProperties from "./inspector/FixtureVisualizationProperties.vue";
import ImportedModelProperties from "./inspector/ImportedModelProperties.vue";
import LibraryAssetProperties from "./inspector/LibraryAssetProperties.vue";

const store = useScene();

const KIND_LABELS: Record<string, string> = {
    shape: "Shape",
    fixtureVisualization: "Fixture visualization",
    importedModel: "Imported model",
    group: "Group",
    libraryAsset: "Library asset",
};

const active = computed(() => (store.activeId ? store.scene.objects[store.activeId] : undefined));
const kindLabel = computed(() => (active.value ? KIND_LABELS[active.value.kind] ?? active.value.kind : ""));

const nameDraft = ref("");
watch(
    () => active.value?.name,
    (name) => (nameDraft.value = name ?? ""),
    { immediate: true }
);

/** Empty names are rejected (data-model: non-empty after trimming). */
function commitName() {
    if (!active.value) {
        return;
    }
    if (nameDraft.value.trim().length === 0) {
        nameDraft.value = active.value.name;
        return;
    }
    store.rename(active.value.id, nameDraft.value);
}
</script>

<style scoped>
.inspector {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    overflow: auto;
    height: 100%;
}

.empty,
.hint,
.multi {
    opacity: 0.7;
    font-size: 0.85rem;
}

.header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.name {
    flex: 1;
    min-width: 0;
}
</style>
