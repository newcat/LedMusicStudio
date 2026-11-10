<template>
    <div class="beam-settings">
        <template v-if="hasMovingParts">
            <LabelledFormField label="Movement">
                <SelectButton
                    v-model="config.movement.mode"
                    :options="MOVEMENT_OPTIONS"
                    option-label="label"
                    option-value="value"
                    :allow-empty="false"
                />
            </LabelledFormField>
            <div v-if="config.movement.mode === 'realistic'" class="row">
                <LabelledFormField label="Pan speed">
                    <InputNumber v-model="config.movement.panSpeed" :min="30" :max="1500" suffix=" °/s" />
                </LabelledFormField>
                <LabelledFormField label="Tilt speed">
                    <InputNumber v-model="config.movement.tiltSpeed" :min="30" :max="1500" suffix=" °/s" />
                </LabelledFormField>
            </div>
        </template>

        <LabelledFormField v-if="!isMapped('zoom')" label="Default beam angle">
            <InputNumber v-model="config.defaultBeamAngle" :min="1" :max="120" :max-fraction-digits="1" suffix="°" />
        </LabelledFormField>

        <LabelledFormField :label="`Edge softness (${config.softness.toFixed(2)})`">
            <Slider v-model="config.softness" :min="0" :max="1" :step="0.01" class="slider" />
        </LabelledFormField>

        <LabelledFormField v-if="isMapped('prism')" label="Prism spread">
            <InputNumber v-model="config.prismSpread" :min="1" :max="30" :max-fraction-digits="1" suffix="°" />
        </LabelledFormField>

        <Fieldset legend="Capability Mapping" toggleable>
            <CapabilityMappingEditor v-model:mapping="config.mapping" :type="controller.type" :controller="controller" />
        </Fieldset>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Fieldset from "primevue/fieldset";
import InputNumber from "primevue/inputnumber";
import SelectButton from "primevue/selectbutton";
import Slider from "primevue/slider";

import { assetCatalog } from "@/assetLibrary/catalog";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { DmxFixture } from "@/stage";
import type { CapabilityKey } from "@/visualization/capabilities/types";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { useLiveConfig } from "../useLiveConfig";
import CapabilityMappingEditor from "../CapabilityMappingEditor.vue";
import type { BeamVisualizationConfig } from "./types";

/** Settings of the Spot and Moving Head visualizations (both rendered by `BeamRenderer`). */

defineOptions({ inheritAttrs: false });

const MOVEMENT_OPTIONS = [
    { label: "Realistic", value: "realistic" },
    { label: "Instant", value: "instant" },
];

const props = defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
    /** Model of the visualization object; the movement settings only apply to models with pan/tilt parts. */
    modelId?: string;
}>();

const rawConfig = defineModel<BeamVisualizationConfig>("config", { required: true });
const config = useLiveConfig(rawConfig, (value) => (rawConfig.value = value));

const hasMovingParts = computed(() => {
    if (props.modelId === undefined) {
        return true;
    }
    const definition = assetCatalog.get(props.modelId);
    const parts = definition?.category === "fixtures" ? definition.fixture.movingParts : undefined;
    return !!(parts?.pan || parts?.tilt);
});

function isMapped(key: CapabilityKey): boolean {
    return (config.value.mapping.channels[key]?.channel ?? -1) >= 0;
}
</script>

<style scoped>
.beam-settings {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.row {
    display: flex;
    gap: 0.75rem;
}

.slider {
    margin: 0.75rem 0.5rem;
}
</style>
