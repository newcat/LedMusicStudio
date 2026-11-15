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

    <InspectorSection v-if="mapping && controller" ref="mappingSection" name="channelMapping" title="Channel mapping">
        <template #actions>
            <template v-if="mappingTotal > 0">
                <Tag severity="secondary" class="count" :value="`${mappingMapped}/${mappingTotal}`" />
                <Button text size="small" icon="pi pi-sparkles" label="Auto-Assign" class="auto-assign" @click="mappingEditor?.onAutoAssign($event)" />
            </template>
        </template>
        <CapabilityMappingEditor
            ref="mappingEditor"
            :mapping="mapping"
            :type="object.visualizationType"
            :controller="controller"
            :model-id="object.modelId"
            :emitter-count="cellEmitterCount"
            :note="mappingNote"
            @update:mapping="onMappingChanged"
        />
    </InspectorSection>
</template>

<script setup lang="ts">
import { computed, ref, toRaw } from "vue";
import Select from "primevue/select";
import Button from "primevue/button";
import Tag from "primevue/tag";

import { useStage } from "@/stage/stage";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { getVisualizationByType } from "@/visualization/fixtureVisualizations/factory";
import { assetCatalog } from "@/assetLibrary/catalog";
import type { DmxFixture } from "@/stage/fixtures";
import type { CapabilityMapping } from "@/visualization/capabilities/types";
import type { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import CapabilityMappingEditor from "@/visualization/fixtureVisualizations/CapabilityMappingEditor.vue";
import { fixtureModelOf } from "@/visualization/fixtureVisualizations/defaultMapping";
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
const mappingSection = ref<InstanceType<typeof InspectorSection>>();
const mappingEditor = ref<InstanceType<typeof CapabilityMappingEditor>>();

const fixture = computed(() => (props.object.fixtureId ? stage.fixtures.get(props.object.fixtureId) : undefined));
const visualization = computed(() => getVisualizationByType(props.object.visualizationType));
const settingsComponent = computed(() => visualization.value.settingsComponent);
/** Only LED strips can be configured without a fixture; DMX types need its channel names. */
const needsFixture = computed(() => props.object.visualizationType !== VisualizationType.LED_STRIP);
const controller = computed(() => stage.visualization.controllers.get(props.object.id) as FixtureVisualizationController<DmxFixture> | undefined);

/** DMX visualization types carry a capability mapping (feature 006: its own section, after the type settings). */
const mapping = computed(() => (props.object.config as { mapping?: CapabilityMapping }).mapping ?? null);
const mappingMapped = computed(() => mappingEditor.value?.mappedCount ?? 0);
const mappingTotal = computed(() => mappingEditor.value?.totalCount ?? 0);
const mappingNote = computed(() =>
    props.object.visualizationType === VisualizationType.GENERIC
        ? "White when no color channel is mapped, full output when no dimmer channel is mapped."
        : undefined
);
/** `cell-*` emitters of a generic model (decodeCells binds the pixels to these). */
const cellEmitterCount = computed(() => {
    if (props.object.visualizationType !== VisualizationType.GENERIC) {
        return undefined;
    }
    const model = fixtureModelOf(props.object.modelId);
    return model ? model.fixture.emitters.filter((emitter) => emitter.id.startsWith("cell-")).length : undefined;
});

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

defineExpose({ revealMapping: () => (mappingSection.value ?? settingsSection.value)?.reveal() });

function onMappingChanged(next: CapabilityMapping) {
    onConfigChanged({ ...(toRaw(props.object.config) as object), mapping: next });
}

function onConfigChanged(config: unknown) {
    store.updateObjects({ [props.object.id]: { config } as Partial<SceneObject> }, "Edit visualization", `config:${props.object.id}`);
}
</script>

<style scoped>
.count {
    font-size: 0.75rem;
    padding: 0 0.4rem;
}

.auto-assign {
    padding-top: 0.15rem;
    padding-bottom: 0.15rem;
}

.model-size {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--insp-gap-2);
    min-height: 2rem;
    font-size: 0.875rem;
}
</style>
