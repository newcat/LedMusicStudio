<template>
    <div class="effect-settings">
        <Message v-if="triggerMissing" severity="warn" size="small" :closable="false">No trigger channel mapped – the effect stays off.</Message>

        <template v-if="laser">
            <div class="row">
                <LabelledFormField label="Pattern">
                    <Select v-model="laser.pattern" :options="PATTERN_OPTIONS" option-label="label" option-value="value" size="small" />
                </LabelledFormField>
                <LabelledFormField label="Color">
                    <ColorPicker :model-value="laser.color.slice(1)" format="hex" aria-label="Laser color" @update:model-value="setLaserColor" />
                </LabelledFormField>
            </div>
            <div class="row">
                <LabelledFormField label="Beams">
                    <InputNumber v-model="laser.beams" :min="1" :max="64" />
                </LabelledFormField>
                <LabelledFormField label="Spread">
                    <InputNumber v-model="laser.spread" :min="1" :max="180" :max-fraction-digits="1" suffix="°" />
                </LabelledFormField>
            </div>
            <div class="text-sm opacity-70">Pattern and color apply while no pattern or color channel is mapped.</div>
        </template>

        <LabelledFormField v-if="heightOptions" :label="isMapped('height') ? 'Maximum height' : 'Height'">
            <InputNumber v-model="heightOptions.maxHeight" :min="0.5" :max="15" :max-fraction-digits="1" suffix=" m" />
        </LabelledFormField>

        <template v-if="fog">
            <LabelledFormField label="Type">
                <SelectButton v-model="fog.fogType" :options="FOG_TYPE_OPTIONS" option-label="label" option-value="value" :allow-empty="false" />
            </LabelledFormField>
            <LabelledFormField :label="`Haze contribution (${fog.hazeContribution.toFixed(2)})`">
                <Slider v-model="fog.hazeContribution" :min="0" :max="1" :step="0.01" class="slider" />
            </LabelledFormField>
            <div class="text-sm opacity-70">Raises the scene haze while the machine runs, when hazer coupling is on in the environment.</div>
        </template>

        <Fieldset legend="Capability Mapping" toggleable>
            <CapabilityMappingEditor v-model:mapping="config.mapping" :type="controller.type" :controller="controller" :model-id="modelId" />
        </Fieldset>
    </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import ColorPicker from "primevue/colorpicker";
import Fieldset from "primevue/fieldset";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";
import Select from "primevue/select";
import SelectButton from "primevue/selectbutton";
import Slider from "primevue/slider";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { DmxFixture } from "@/stage";
import type { CapabilityKey } from "@/visualization/capabilities/types";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { useLiveConfig } from "../useLiveConfig";
import CapabilityMappingEditor from "../CapabilityMappingEditor.vue";
import { defaultEffectOptions, effectKindOf, type EffectVisualizationConfig, type FlameOptions, type FogOptions, type JetOptions, type LaserOptions, type SparkOptions } from "./types";

/** Settings of the effect visualizations: Laser, Flame, CO2 Jet, Cold Spark, Fog / Haze (feature 003, T061). */

defineOptions({ inheritAttrs: false });

const PATTERN_OPTIONS: Array<{ label: string; value: LaserOptions["pattern"] }> = [
    { label: "Beam", value: "beam" },
    { label: "Fan", value: "fan" },
    { label: "Cone", value: "cone" },
    { label: "Sheet", value: "sheet" },
    { label: "Dots", value: "dots" },
];

const FOG_TYPE_OPTIONS: Array<{ label: string; value: FogOptions["fogType"] }> = [
    { label: "Haze", value: "haze" },
    { label: "Fog", value: "fog" },
];

const props = defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
    /** Model of the visualization object (Auto-Assign fallbacks). */
    modelId?: string;
}>();

const rawConfig = defineModel<EffectVisualizationConfig>("config", { required: true });
const config = useLiveConfig(rawConfig, (value) => (rawConfig.value = value));

const kind = computed(() => effectKindOf(props.controller.type));

// Options of another kind (e.g. after a type change) are replaced by the defaults of this type.
watch(
    [kind, () => config.value.options?.kind],
    ([expected, actual]) => {
        if (expected && actual !== expected) {
            config.value.options = defaultEffectOptions(expected);
        }
    },
    { immediate: true }
);

const laser = computed(() => (config.value.options.kind === "laser" ? config.value.options : null));
const heightOptions = computed<FlameOptions | JetOptions | SparkOptions | null>(() => {
    const options = config.value.options;
    return options.kind === "flame" || options.kind === "co2" || options.kind === "spark" ? options : null;
});
const fog = computed(() => (config.value.options.kind === "fog" ? config.value.options : null));

function isMapped(key: CapabilityKey): boolean {
    return (config.value.mapping.channels[key]?.channel ?? -1) >= 0;
}

/** Flame, CO2 and spark need `trigger`, fog needs `fogOutput`; the laser runs on its dimmer (default full). */
const triggerMissing = computed(() => {
    switch (kind.value) {
        case "flame":
        case "co2":
        case "spark":
            return !isMapped("trigger");
        case "fog":
            return !isMapped("fogOutput");
        default:
            return false;
    }
});

function setLaserColor(value: unknown) {
    if (laser.value && typeof value === "string" && /^[0-9a-fA-F]{6}$/.test(value)) {
        laser.value.color = `#${value.toLowerCase()}`;
    }
}
</script>

<style scoped>
.effect-settings {
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
