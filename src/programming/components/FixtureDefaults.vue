<template>
    <div v-if="profile" class="fixture-defaults">
        <h3 class="font-bold">Defaults</h3>
        <p class="text-sm opacity-70">Values used when no clip controls an attribute. Override them per fixture.</p>
        <div class="rows">
            <template v-for="key in keys" :key="key">
                <div class="label">{{ ATTRIBUTES[key].label }}</div>
                <ToggleSwitch v-tooltip.top="'Override'" :model-value="isOverridden(key)" @update:model-value="setOverride(key, $event)" />
                <AttributeValueEditor
                    v-if="isOverridden(key)"
                    :attribute-key="key"
                    :model-value="valueOf(key)"
                    :profiles="profiles"
                    @update:model-value="setValue(key, $event)"
                />
                <div v-else class="text-sm opacity-70">{{ describe(key, profile.builtInDefaults[key]) }}</div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ToggleSwitch from "primevue/toggleswitch";
import type { DmxFixture } from "@/stage";
import { ATTRIBUTE_KEYS, ATTRIBUTES, cloneValue, omitKey, isSlotAttribute, slotLabel, type AttributeKey, type AttributeValue, type AttributeValues, type Rgb, type ShutterValue } from "../attributes";
import { rgbToHex } from "../color";
import { getProfile, profileOptions } from "../profile";
import AttributeValueEditor from "./AttributeValueEditor.vue";

const props = defineProps<{ fixture: DmxFixture }>();

const profile = computed(() => {
    // re-read on config changes (definition, mode)
    void props.fixture.config.definition;
    void props.fixture.config.mode;
    return getProfile(props.fixture.id);
});
const profiles = computed(() => {
    void profile.value;
    return profileOptions([props.fixture.id]);
});
const keys = computed(() => ATTRIBUTE_KEYS.filter((k) => profile.value?.supported.has(k)));
const overrides = computed<AttributeValues>(() => props.fixture.config.defaults ?? {});

function isOverridden(key: AttributeKey): boolean {
    return overrides.value[key] !== undefined;
}

function valueOf(key: AttributeKey): AttributeValue {
    return (overrides.value[key] ?? profile.value!.builtInDefaults[key]) as AttributeValue;
}

function write(next: AttributeValues) {
    props.fixture.setConfig({ ...props.fixture.config, defaults: next });
}

function setOverride(key: AttributeKey, on: boolean) {
    if (on) {
        write({ ...overrides.value, [key]: cloneValue(key, profile.value!.builtInDefaults[key]) } as AttributeValues);
    } else {
        write(omitKey(overrides.value, key));
    }
}

function setValue(key: AttributeKey, value: AttributeValue) {
    write({ ...overrides.value, [key]: value } as AttributeValues);
}

function describe(key: AttributeKey, value: AttributeValue): string {
    if (key === "color") {
        return rgbToHex(value as Rgb);
    }
    if (key === "shutter") {
        const s = value as ShutterValue;
        return s.mode === "strobe" ? `strobe ${s.rate} Hz` : s.mode;
    }
    if (isSlotAttribute(key)) {
        return key === "colorMacro" && value === 0 ? "none" : key === "prism" && value === 0 ? "off" : slotLabel(profile.value, key, value as number);
    }
    const v = value as number;
    switch (key) {
        case "dimmer":
        case "panTiltSpeed":
        case "zoom":
        case "focus":
            return `${Math.round(v * 100)} %`;
        case "pan":
        case "tilt":
            return profile.value?.panTiltNormalized ? String(v) : `${v}°`;
        case "colorTemperature":
            return `${v} K`;
        default:
            return `${v} rps`;
    }
}
</script>

<style scoped>
.fixture-defaults {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
}
.rows {
    display: grid;
    grid-template-columns: max-content min-content 1fr;
    gap: 0.5rem 1rem;
    align-items: center;
}
</style>
