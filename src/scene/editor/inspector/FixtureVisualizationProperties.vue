<template>
    <div class="fixture-visualization-properties">
        <LabelledFormField label="Linked fixture">
            <Select
                :model-value="object.fixtureId ?? NONE"
                :options="fixtureOptions"
                option-label="label"
                option-value="value"
                @update:model-value="onLinkChanged"
            />
        </LabelledFormField>
        <LabelledFormField label="Visualization type">
            <Select
                :model-value="object.visualizationType"
                :options="typeOptions"
                option-label="label"
                option-value="value"
                @update:model-value="onTypeChanged"
            />
        </LabelledFormField>

        <LabelledFormField label="Model">
            <ModelSelect :model-value="object.modelId" :type="object.visualizationType" @update:model-value="onModelChanged" />
        </LabelledFormField>
        <div v-if="modelUnknown" class="notice">Model {{ object.modelId }} is not available; showing the generic fixture.</div>
        <LabelledFormField label="Model size">
            <div class="model-size">
                <span>{{ modelSizeLabel }}</span>
                <Button
                    text
                    size="small"
                    label="Reset to model size"
                    icon="pi pi-refresh"
                    :disabled="object.modelScale === 1"
                    @click="store.resetModelScale(object.id)"
                />
            </div>
            <div v-if="scaledToFixture" class="hint">Scaled to fixture dimensions</div>
        </LabelledFormField>

        <template v-if="settingsComponent">
            <component
                :is="settingsComponent"
                v-if="controller || !needsFixture"
                :config="object.config"
                :controller="controller"
                :model-id="object.modelId"
                :object-id="object.id"
                @update:config="onConfigChanged"
            />
            <div v-else class="hint">Link a fixture to map its DMX channels.</div>
        </template>

        <Button outlined label="Open fixture settings" icon="mdi mdi-lamp" :disabled="!object.fixtureId" @click="openFixtureSettings" />
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Select from "primevue/select";
import Button from "primevue/button";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { useStage } from "@/stage/stage";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { getVisualizationByType } from "@/visualization/fixtureVisualizations/factory";
import { activeStageTab, selectedFixtureId, STAGE_TAB_FIXTURES } from "@/views/stageViewState";
import { assetCatalog } from "@/assetLibrary/catalog";
import { useScene } from "../../sceneStore";
import { hasPlausibleDimensions } from "../../fixtureModels";
import ModelSelect from "./ModelSelect.vue";
import type { FixtureVisualizationObject, SceneObject } from "../../model/types";

const NONE = "NONE";

const props = defineProps<{
    object: FixtureVisualizationObject;
}>();

const store = useScene();
const stage = useStage();

const visualization = computed(() => getVisualizationByType(props.object.visualizationType));
const settingsComponent = computed(() => visualization.value.settingsComponent);
/** Only LED strips can be configured without a fixture; DMX types need its channel names. */
const needsFixture = computed(() => props.object.visualizationType !== VisualizationType.LED_STRIP);
const controller = computed(() => stage.visualization.controllers.get(props.object.id));

/** None, compatible fixtures without a visualization object yet, and the current one. */
const fixtureOptions = computed(() => {
    const options: Array<{ label: string; value: string }> = [{ label: "None", value: NONE }];
    for (const fixture of stage.fixtures.values()) {
        const compatible = visualization.value.compatibleFixtures.includes(fixture.type);
        const free = !store.findObjectByFixture(fixture.id);
        if (fixture.id === props.object.fixtureId || (compatible && free)) {
            options.push({ label: fixture.name, value: fixture.id });
        }
    }
    return options;
});

/** Only types that fit the linked fixture are offered. */
const typeOptions = computed(() => {
    const fixture = props.object.fixtureId ? stage.fixtures.get(props.object.fixtureId) : undefined;
    return Object.values(VisualizationType)
        .filter((type) => !fixture || getVisualizationByType(type).compatibleFixtures.includes(fixture.type))
        .map((type) => ({ label: type, value: type }));
});

const modelUnknown = computed(() => assetCatalog.get(props.object.modelId)?.category !== "fixtures");
const modelSizeLabel = computed(() => `${Math.round(props.object.modelScale * 100)} %`);
const scaledToFixture = computed(() => {
    const fixture = props.object.fixtureId ? stage.fixtures.get(props.object.fixtureId) : undefined;
    return props.object.modelScale !== 1 && hasPlausibleDimensions(fixture);
});

function onModelChanged(modelId: string) {
    store.setFixtureModel(props.object.id, modelId);
}

function onLinkChanged(value: string) {
    store.linkFixture(props.object.id, value === NONE ? null : value);
}

function onTypeChanged(value: VisualizationType) {
    store.setVisualizationType(props.object.id, value);
}

function onConfigChanged(config: unknown) {
    store.updateObjects({ [props.object.id]: { config } as Partial<SceneObject> }, "Edit visualization", `config:${props.object.id}`);
}

function openFixtureSettings() {
    if (props.object.fixtureId) {
        selectedFixtureId.value = props.object.fixtureId;
        activeStageTab.value = STAGE_TAB_FIXTURES;
    }
}
</script>

<style scoped>
.fixture-visualization-properties {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.model-size {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.notice {
    font-size: 0.85rem;
    color: var(--p-orange-400, orange);
}

.hint {
    font-size: 0.85rem;
    opacity: 0.7;
}
</style>
