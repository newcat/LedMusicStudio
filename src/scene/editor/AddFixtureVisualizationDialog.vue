<template>
    <Dialog v-model:visible="visible" modal header="Add fixture visualization" :style="{ width: '26rem' }">
        <div class="flex flex-col gap-4">
            <LabelledFormField label="Fixture">
                <Select
                    v-model="fixtureId"
                    :options="fixtureOptions"
                    option-label="label"
                    option-value="value"
                    placeholder="Choose a fixture"
                    empty-message="All fixtures already have a visualization."
                />
            </LabelledFormField>
            <LabelledFormField label="Visualization type">
                <Select v-model="type" :options="typeOptions" option-label="label" option-value="value" placeholder="Choose a type" />
            </LabelledFormField>
            <LabelledFormField label="Model">
                <ModelSelect v-model="modelId" :type="type" :disabled="!type" />
            </LabelledFormField>
        </div>
        <template #footer>
            <Button text label="Cancel" @click="visible = false" />
            <Button label="Add" :disabled="!fixtureId || !type || !modelId" @click="confirm" />
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import Button from "primevue/button";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { useStage } from "@/stage/stage";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { getVisualizationByType } from "@/visualization/fixtureVisualizations/factory";
import { assetCatalog } from "@/assetLibrary/catalog";
import { useScene } from "../sceneStore";
import { modelForType, preselectionOf } from "../fixtureModels";
import ModelSelect from "./inspector/ModelSelect.vue";

const visible = defineModel<boolean>("visible", { required: true });

const emit = defineEmits<{
    confirm: [fixtureId: string, type: VisualizationType, modelId: string];
}>();

const stage = useStage();
const store = useScene();

const fixtureId = ref<string | null>(null);
const type = ref<VisualizationType | null>(null);
const modelId = ref<string | null>(null);

const fixture = computed(() => (fixtureId.value ? stage.fixtures.get(fixtureId.value) : undefined));

/** Only fixtures without a visualization object. */
const fixtureOptions = computed(() =>
    stage.fixtures
        .getArray()
        .filter((fixture) => !store.findObjectByFixture(fixture.id))
        .map((fixture) => ({ label: fixture.name, value: fixture.id }))
);

/** Only types that are compatible with the chosen fixture. */
const typeOptions = computed(() => {
    if (!fixture.value) {
        return [];
    }
    const fixtureType = fixture.value.type;
    return Object.values(VisualizationType)
        .filter((t) => getVisualizationByType(t).compatibleFixtures.includes(fixtureType))
        .map((t) => ({ label: t, value: t }));
});

/** FR-014: type and model are preselected from the OFL category (DMX), otherwise the only or no type. */
watch(fixtureId, () => {
    const preselection = preselectionOf(fixture.value);
    const options = typeOptions.value.map((o) => o.value);
    if (preselection && options.includes(preselection.visualizationType)) {
        type.value = preselection.visualizationType;
        modelId.value = preselection.modelId;
    } else {
        type.value = options.length === 1 ? options[0] : null;
        modelId.value = type.value ? assetCatalog.defaultModelFor(type.value).id : null;
    }
});

/** A type change resets the model to the mapped model (if it is of this type) or the type's default. */
watch(type, (newType) => {
    modelId.value = newType ? modelForType(fixture.value, newType, true).modelId : null;
});

watch(visible, (isVisible) => {
    if (isVisible) {
        fixtureId.value = null;
        type.value = null;
        modelId.value = null;
    }
});

function confirm() {
    if (fixtureId.value && type.value && modelId.value) {
        emit("confirm", fixtureId.value, type.value, modelId.value);
        visible.value = false;
    }
}
</script>
