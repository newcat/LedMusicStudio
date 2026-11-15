<template>
    <div v-if="profile" class="fixture-defaults">
        <p class="intro">Values used when no clip controls an attribute.</p>
        <PropertyRow v-for="key in keys" :key="key" :label="ATTRIBUTES[key].label">
            <div class="default-row">
                <ToggleSwitch
                    v-tooltip.top="'Override'"
                    class="toggle"
                    :model-value="isOverridden(key)"
                    :aria-label="`Override ${ATTRIBUTES[key].label}`"
                    @update:model-value="setOverride(key, $event)"
                />
                <div class="value">
                    <AttributeValueEditor
                        v-if="isOverridden(key)"
                        :attribute-key="key"
                        :model-value="valueOf(key)"
                        :profiles="profiles"
                        @update:model-value="setValue(key, $event)"
                    />
                    <span v-else class="built-in">{{ describe(key, profile.builtInDefaults[key]) }}</span>
                </div>
            </div>
        </PropertyRow>
    </div>
</template>

<script setup lang="ts">
import { computed, toRaw } from "vue";
import ToggleSwitch from "primevue/toggleswitch";
import type { DmxFixture } from "@/stage";
import { useScene } from "@/scene/sceneStore";
import PropertyRow from "@/scene/editor/inspector/PropertyRow.vue";
import { ATTRIBUTE_KEYS, ATTRIBUTES, cloneValue, omitKey, isSlotAttribute, slotLabel, type AttributeKey, type AttributeValue, type AttributeValues, type Rgb, type ShutterValue } from "../attributes";
import { rgbToHex } from "../color";
import { getProfile, profileOptions } from "../profile";
import AttributeValueEditor from "./AttributeValueEditor.vue";

const props = defineProps<{ fixture: DmxFixture }>();

const scene = useScene();

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

/** Undoable (feature 006): through the scene store, merged while the same fixture's defaults are edited. */
function write(next: AttributeValues) {
    scene.updateFixture(props.fixture.id, { config: { ...toRaw(props.fixture.config), defaults: next } }, "Change default", `fixture:${props.fixture.id}:defaults`);
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
    gap: var(--insp-gap-2, 8px);
}

.intro {
    margin: 0;
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
}

.default-row {
    display: flex;
    align-items: center;
    gap: var(--insp-gap-2, 8px);
    min-height: 2rem;
    min-width: 0;
}

.toggle {
    flex-shrink: 0;
}

.value {
    flex: 1;
    min-width: 0;
}

/* the shared value editor uses fixed widths; let it wrap and shrink inside the inspector */
.value :deep(.attribute-value-editor) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--insp-gap-1, 4px);
    min-width: 0;
}

.value :deep(.p-select),
.value :deep(.w-32) {
    min-width: 0;
    max-width: 100%;
    flex: 1 1 6rem;
}

.built-in {
    font-size: 0.8125rem;
    color: var(--p-text-muted-color);
}
</style>
