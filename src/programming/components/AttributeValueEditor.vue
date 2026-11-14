<template>
    <div class="attribute-value-editor">
        <!-- color -->
        <template v-if="attributeKey === 'color'">
            <ColorPicker :model-value="hex" format="hex" @update:model-value="setHex" />
            <span class="text-xs opacity-70">#{{ hex }}</span>
        </template>

        <!-- shutter -->
        <template v-else-if="attributeKey === 'shutter'">
            <Select :model-value="shutter.mode" :options="SHUTTER_MODES" size="small" class="w-28" @update:model-value="setShutter({ mode: $event })" />
            <InputNumber
                v-if="shutter.mode === 'strobe'"
                :model-value="shutter.rate"
                :min="0"
                :max-fraction-digits="2"
                suffix=" Hz"
                size="small"
                input-class="w-20"
                @update:model-value="setShutter({ rate: $event ?? 0 })"
            />
        </template>

        <!-- slots by name -->
        <template v-else-if="isSlot">
            <Select
                v-if="slotGroups.length > 0"
                :model-value="numberValue"
                :options="slotGroups"
                option-label="label"
                option-value="value"
                option-group-label="label"
                option-group-children="items"
                size="small"
                class="min-w-40"
                @update:model-value="emitValue($event)"
            />
            <InputNumber v-else :model-value="numberValue" :min="attributeKey === 'prism' ? 0 : 1" size="small" input-class="w-20" @update:model-value="emitValue($event ?? 1)" />
        </template>

        <!-- 0..1 values as percent -->
        <template v-else-if="isPercent">
            <Slider :model-value="numberValue * 100" :min="0" :max="100" class="w-32" @update:model-value="emitValue((Array.isArray($event) ? $event[0] : $event) / 100)" />
            <InputNumber :model-value="Math.round(numberValue * 1000) / 10" :min="0" :max="100" :max-fraction-digits="1" suffix=" %" size="small" input-class="w-20" @update:model-value="emitValue(($event ?? 0) / 100)" />
        </template>

        <!-- other numbers with unit -->
        <template v-else>
            <InputNumber
                :model-value="numberValue"
                :min="range?.min"
                :max="range?.max"
                :max-fraction-digits="unitInfo.digits"
                :step="unitInfo.step"
                :suffix="unitInfo.suffix"
                show-buttons
                size="small"
                input-class="w-24"
                @update:model-value="emitValue($event ?? 0)"
            />
            <span v-if="normalizedHint" class="text-xs opacity-70">0–1, no angle range</span>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ColorPicker from "primevue/colorpicker";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import Slider from "primevue/slider";
import { isSlotAttribute, type AttributeKey, type AttributeValue, type FixtureProfile, type Range, type Rgb, type ShutterValue } from "../attributes";
import { hexToRgb, rgbToHex } from "../color";

const SHUTTER_MODES: Array<ShutterValue["mode"]> = ["open", "closed", "strobe"];

const props = defineProps<{
    attributeKey: AttributeKey;
    modelValue: AttributeValue;
    /** Profiles of the fixtures the value is for (slot names, ranges); names are grouped by model when mixed. */
    profiles?: Array<{ profile: FixtureProfile; label: string }>;
}>();

const emit = defineEmits<{ "update:modelValue": [value: AttributeValue] }>();

const isSlot = computed(() => isSlotAttribute(props.attributeKey));
const isPercent = computed(() => ["dimmer", "panTiltSpeed", "zoom", "focus"].includes(props.attributeKey));
const normalized = computed(() => (props.profiles ?? []).some((p) => p.profile.panTiltNormalized));
const normalizedHint = computed(() => (props.attributeKey === "pan" || props.attributeKey === "tilt") && normalized.value);

const numberValue = computed(() => (typeof props.modelValue === "number" ? props.modelValue : 0));

/** Widest range over all profiles (null without profiles: no limits). */
const range = computed<Range | null>(() => {
    let result: Range | null = null;
    for (const { profile } of props.profiles ?? []) {
        const r = profile.ranges[props.attributeKey];
        if (r) {
            result = result ? { min: Math.min(result.min, r.min), max: Math.max(result.max, r.max) } : { ...r };
        }
    }
    return result;
});

const unitInfo = computed(() => {
    switch (props.attributeKey) {
        case "pan":
        case "tilt":
            return normalized.value ? { suffix: "", step: 0.01, digits: 3 } : { suffix: " °", step: 1, digits: 2 };
        case "colorTemperature":
            return { suffix: " K", step: 100, digits: 0 };
        case "goboRotation":
        case "prismRotation":
            return { suffix: " rps", step: 0.1, digits: 2 };
        default:
            return { suffix: "", step: 0.01, digits: 3 };
    }
});

const slotGroups = computed(() => {
    const key = props.attributeKey;
    if (!isSlotAttribute(key)) {
        return [];
    }
    const groups: Array<{ label: string; items: Array<{ label: string; value: number }> }> = [];
    const seen = new Set<string>();
    for (const { profile, label } of props.profiles ?? []) {
        const slots = profile.slots[key] ?? [];
        const items = [...(key === "prism" ? [{ label: "0 Off", value: 0 }] : []), ...slots.map((s) => ({ label: `${s.number} ${s.name}`, value: s.number }))];
        const signature = items.map((i) => i.label).join("|");
        if (items.length === 0 || seen.has(signature)) {
            continue;
        }
        seen.add(signature);
        groups.push({ label, items });
    }
    return groups;
});

const hex = computed(() => (Array.isArray(props.modelValue) ? rgbToHex(props.modelValue as Rgb).slice(1) : "ffffff"));

const shutter = computed<ShutterValue>(() => {
    const v = props.modelValue as ShutterValue;
    return typeof v === "object" && v !== null && "mode" in v ? v : { mode: "open", rate: 10 };
});

function emitValue(v: AttributeValue) {
    emit("update:modelValue", v);
}

function setHex(value: string | object) {
    const rgb = typeof value === "string" ? hexToRgb(value) : null;
    if (rgb) {
        emitValue(rgb);
    }
}

function setShutter(patch: Partial<ShutterValue>) {
    emitValue({ ...shutter.value, ...patch });
}
</script>

<style scoped>
.attribute-value-editor {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}
</style>
