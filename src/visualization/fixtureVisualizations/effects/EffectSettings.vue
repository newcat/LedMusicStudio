<template>
    <Message v-if="triggerMissing" severity="warn" size="small" :closable="false">No trigger channel mapped – the effect stays off.</Message>

    <template v-if="laser">
        <PropertyRow label="Pattern">
            <Select v-model="laser.pattern" :options="PATTERN_OPTIONS" option-label="label" option-value="value" size="small" fluid />
        </PropertyRow>
        <PropertyRow label="Color" hint="Pattern and color apply while no pattern or color channel is mapped.">
            <div class="color-row">
                <ColorPicker :model-value="laser.color.slice(1)" format="hex" aria-label="Laser color" @update:model-value="setLaserColor" />
            </div>
        </PropertyRow>
        <PropertyRow label="Beams">
            <InputNumber v-model="laser.beams" :min="1" :max="64" size="small" fluid />
        </PropertyRow>
        <PropertyRow label="Spread">
            <InputNumber v-model="laser.spread" :min="1" :max="180" :max-fraction-digits="1" suffix="°" size="small" fluid />
        </PropertyRow>
    </template>

    <PropertyRow v-if="heightOptions" :label="isMapped('height') ? 'Maximum height' : 'Height'">
        <InputNumber v-model="heightOptions.maxHeight" :min="0.5" :max="15" :max-fraction-digits="1" suffix=" m" size="small" fluid />
    </PropertyRow>

    <template v-if="fog">
        <PropertyRow label="Type">
            <SelectButton v-model="fog.fogType" :options="FOG_TYPE_OPTIONS" option-label="label" option-value="value" :allow-empty="false" size="small" fluid />
        </PropertyRow>
        <PropertyRow label="Haze" hint="Raises the scene haze while the machine runs, when hazer coupling is on in the environment.">
            <SliderField v-model="fog.hazeContribution" :min="0" :max="1" :step="0.01" />
        </PropertyRow>
    </template>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import ColorPicker from "primevue/colorpicker";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";
import Select from "primevue/select";
import SelectButton from "primevue/selectbutton";

import PropertyRow from "@/scene/editor/inspector/PropertyRow.vue";
import SliderField from "@/scene/editor/inspector/SliderField.vue";
import { DmxFixture } from "@/stage";
import type { CapabilityKey } from "@/visualization/capabilities/types";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { useLiveConfig } from "../useLiveConfig";
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
.color-row {
    display: flex;
    align-items: center;
    min-height: 2rem;
}
</style>
