<template>
    <div class="attribute-input" :title="tooltip">
        <button class="__remove" title="Remove attribute" @pointerdown.stop @click.stop="intf.onRemove?.()">×</button>
        <div class="__name">
            {{ intf.name }}<span v-if="intf.hint" class="__hint"> {{ intf.hint }}</span>
        </div>
        <div class="__editor">
            <color-picker v-if="kind === 'color'" v-model="colorValue"></color-picker>
            <template v-else-if="kind === 'shutter'">
                <select v-model="shutterMode" class="baklava-input __select">
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                    <option value="strobe">strobe</option>
                </select>
                <input
                    v-if="shutterMode === 'strobe'"
                    v-model.number="shutterRate"
                    type="number"
                    min="0"
                    step="0.5"
                    class="baklava-input __num"
                    title="Hz"
                />
            </template>
            <select v-else-if="kind === 'slot' && intf.slots.length > 0" v-model.number="numberValue" class="baklava-input __select">
                <option v-for="s in slotOptions" :key="s.number" :value="s.number">{{ s.number }} {{ s.name }}</option>
            </select>
            <input v-else v-model.number="numberValue" type="number" :step="step" class="baklava-input __num" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AttributeInputInterface, AttributeInputState } from "../interfaces/AttributeInputInterface";
import { ATTRIBUTES, isSlotAttribute, type ShutterValue } from "@/programming/attributes";
import ColorPicker from "./ColorPicker.vue";
import type { Color } from "../colors";

const modelValue = defineModel<AttributeInputState | number>({ required: true });

const props = defineProps<{
    intf: AttributeInputInterface;
}>();

const kind = computed(() => {
    const key = props.intf.attributeKey;
    return key === "color" ? "color" : key === "shutter" ? "shutter" : isSlotAttribute(key) ? "slot" : "number";
});
const step = computed(() => (["pan", "tilt", "colorTemperature"].includes(props.intf.attributeKey) ? 1 : 0.01));

/** Older or connected states may be a plain value. */
const state = computed<AttributeInputState>(() => {
    const v = modelValue.value as unknown;
    if (typeof v === "object" && v !== null && "enabled" in v) {
        return v as AttributeInputState;
    }
    return { enabled: true, value: v as AttributeInputState["value"] };
});

function update(patch: Partial<AttributeInputState>) {
    modelValue.value = { ...state.value, ...patch };
}

const numberValue = computed({
    get: () => (typeof state.value.value === "number" ? state.value.value : 0),
    set: (v: number) => update({ value: Number.isFinite(v) ? v : 0, enabled: true }),
});
const colorValue = computed({
    get: () => (Array.isArray(state.value.value) ? (state.value.value as Color) : ([255, 255, 255] as Color)),
    set: (v: Color) => update({ value: v, enabled: true }),
});
const shutter = computed<ShutterValue>(() => {
    const v = state.value.value as ShutterValue;
    return typeof v === "object" && v !== null && "mode" in v ? v : { mode: "open", rate: 10 };
});
const shutterMode = computed({
    get: () => shutter.value.mode,
    set: (mode: ShutterValue["mode"]) => update({ value: { ...shutter.value, mode }, enabled: true }),
});
const shutterRate = computed({
    get: () => shutter.value.rate,
    set: (rate: number) => update({ value: { ...shutter.value, rate: Math.max(0, Number.isFinite(rate) ? rate : 0) }, enabled: true }),
});

const slotOptions = computed(() => (props.intf.attributeKey === "prism" ? [{ number: 0, name: "Off" }, ...props.intf.slots] : props.intf.slots));
const tooltip = computed(() => {
    const info = ATTRIBUTES[props.intf.attributeKey];
    if (kind.value === "slot" && props.intf.slots.length > 0) {
        return props.intf.slots.map((s) => `${s.number} ${s.name}`).join(" · ");
    }
    return `${info.label} (${info.unit})`;
});
</script>

<style scoped>
.attribute-input {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}
.__remove {
    flex: none;
    padding: 0 0.2rem;
    border: none;
    background: none;
    color: inherit;
    opacity: 0.55;
    cursor: pointer;
    line-height: 1;
}
.__remove:hover {
    opacity: 1;
}
.__name {
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.__hint {
    opacity: 0.7;
    font-size: 0.8em;
}
.__editor {
    display: flex;
    gap: 0.25rem;
    flex: none;
    width: 90px;
    justify-content: flex-end;
}
.__num {
    width: 60px;
}
.__select {
    max-width: 90px;
}
</style>
