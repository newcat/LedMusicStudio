<template>
    <InspectorSection name="appearance" title="Appearance">
        <PropertyRow label="Type">
            <Select
                :model-value="object.visualizationType"
                :options="typeOptions"
                option-label="label"
                option-value="value"
                size="small"
                fluid
                @update:model-value="onTypeChanged"
            />
        </PropertyRow>
        <PropertyRow label="Model" :warning="modelUnknown ? `Model ${object.modelId} is not available; showing the generic fixture.` : undefined">
            <ModelSelect :model-value="object.modelId" :type="object.visualizationType" @update:model-value="onModelChanged" />
        </PropertyRow>
        <PropertyRow label="Size" :hint="scaledToFixture ? 'Scaled to fixture dimensions' : undefined">
            <div class="model-size">
                <span>{{ modelSizeLabel }}</span>
                <Button
                    v-tooltip.bottom="'Reset to model size'"
                    text
                    rounded
                    size="small"
                    severity="secondary"
                    icon="pi pi-refresh"
                    aria-label="Reset to model size"
                    :disabled="object.modelScale === 1"
                    @click="store.resetModelScale(object.id)"
                />
            </div>
        </PropertyRow>
    </InspectorSection>

    <InspectorSection v-if="settingsComponent" ref="settingsSection" :name="`settings:${settingsTitle}`" :title="settingsTitle">
        <component
            :is="settingsComponent"
            v-if="controller || !needsFixture"
            :config="object.config"
            :controller="controller"
            :model-id="object.modelId"
            :object-id="object.id"
            @update:config="onConfigChanged"
        />
    </InspectorSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Select from "primevue/select";
import Button from "primevue/button";

import { useStage } from "@/stage/stage";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { getVisualizationByType } from "@/visualization/fixtureVisualizations/factory";
import { assetCatalog } from "@/assetLibrary/catalog";
import { useScene } from "../../sceneStore";
import { compatibleVisualizationTypes, hasPlausibleDimensions } from "../../fixtureModels";
import ModelSelect from "./ModelSelect.vue";
import InspectorSection from "./InspectorSection.vue";
import PropertyRow from "./PropertyRow.vue";
import type { FixtureVisualizationObject, SceneObject } from "../../model/types";

/** Appearance and type settings of a fixture object (feature 006, contracts/inspector-ui.md). */
const props = defineProps<{
    object: FixtureVisualizationObject;
}>();

const store = useScene();
const stage = useStage();
const settingsSection = ref<InstanceType<typeof InspectorSection>>();

const fixture = computed(() => (props.object.fixtureId ? stage.fixtures.get(props.object.fixtureId) : undefined));
const visualization = computed(() => getVisualizationByType(props.object.visualizationType));
const settingsComponent = computed(() => visualization.value.settingsComponent);
/** Only LED strips can be configured without a fixture; DMX types need its channel names. */
const needsFixture = computed(() => props.object.visualizationType !== VisualizationType.LED_STRIP);
const controller = computed(() => stage.visualization.controllers.get(props.object.id));

const settingsTitle = computed(() => {
    switch (props.object.visualizationType) {
        case VisualizationType.SPOT:
        case VisualizationType.MOVING_HEAD:
            return "Beam & movement";
        case VisualizationType.LED_STRIP:
            return "Strip";
        case VisualizationType.GENERIC:
            return "Light";
        default:
            return "Effect";
    }
});

/** Only types that fit the fixture (data-model I3). */
const typeOptions = computed(() =>
    (fixture.value ? compatibleVisualizationTypes(fixture.value.type) : Object.values(VisualizationType)).map((type) => ({ label: type, value: type }))
);

const modelUnknown = computed(() => assetCatalog.get(props.object.modelId)?.category !== "fixtures");
const modelSizeLabel = computed(() => `${Math.round(props.object.modelScale * 100)} %`);
const scaledToFixture = computed(() => props.object.modelScale !== 1 && hasPlausibleDimensions(fixture.value));

function onModelChanged(modelId: string) {
    store.setFixtureModel(props.object.id, modelId);
}

function onTypeChanged(value: VisualizationType) {
    store.setVisualizationType(props.object.id, value);
}

defineExpose({ revealMapping: () => settingsSection.value?.reveal() });

function onConfigChanged(config: unknown) {
    store.updateObjects({ [props.object.id]: { config } as Partial<SceneObject> }, "Edit visualization", `config:${props.object.id}`);
}
</script>

<style scoped>
.model-size {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--insp-gap-2);
    min-height: 2rem;
    font-size: 0.875rem;
}
</style>
