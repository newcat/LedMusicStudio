<template>
    <template v-if="hasMovingParts">
        <PropertyRow label="Movement">
            <SelectButton
                v-model="config.movement.mode"
                :options="MOVEMENT_OPTIONS"
                option-label="label"
                option-value="value"
                :allow-empty="false"
                size="small"
                fluid
            />
        </PropertyRow>
        <template v-if="config.movement.mode === 'realistic'">
            <PropertyRow label="Pan speed">
                <InputNumber v-model="config.movement.panSpeed" :min="30" :max="1500" suffix=" °/s" size="small" fluid />
            </PropertyRow>
            <PropertyRow label="Tilt speed">
                <InputNumber v-model="config.movement.tiltSpeed" :min="30" :max="1500" suffix=" °/s" size="small" fluid />
            </PropertyRow>
        </template>
    </template>

    <PropertyRow v-if="!isMapped('zoom')" label="Beam angle">
        <InputNumber v-model="config.defaultBeamAngle" :min="1" :max="120" :max-fraction-digits="1" suffix="°" size="small" fluid />
    </PropertyRow>

    <PropertyRow label="Edge softness">
        <SliderField v-model="config.softness" :min="0" :max="1" :step="0.01" />
    </PropertyRow>

    <PropertyRow v-if="isMapped('prism')" label="Prism spread">
        <InputNumber v-model="config.prismSpread" :min="1" :max="30" :max-fraction-digits="1" suffix="°" size="small" fluid />
    </PropertyRow>
</template>

<script setup lang="ts">
import { computed } from "vue";
import InputNumber from "primevue/inputnumber";
import SelectButton from "primevue/selectbutton";

import { assetCatalog } from "@/assetLibrary/catalog";
import PropertyRow from "@/scene/editor/inspector/PropertyRow.vue";
import SliderField from "@/scene/editor/inspector/SliderField.vue";
import { DmxFixture } from "@/stage";
import type { CapabilityKey } from "@/visualization/capabilities/types";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { useLiveConfig } from "../useLiveConfig";
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
