<template>
    <div class="parameter-fields">
        <LabelledFormField v-for="spec in specs" :key="spec.key" :label="spec.label">
            <template v-if="spec.type === 'number'">
                <InputNumber
                    :key="`${spec.key}:${resetToken}`"
                    :model-value="numberValue(spec.key)"
                    :min="spec.min"
                    :max="spec.max"
                    :step="spec.step"
                    :min-fraction-digits="0"
                    :max-fraction-digits="fractionDigits(spec.step)"
                    :suffix="suffix(spec.unit)"
                    show-buttons
                    button-layout="stacked"
                    size="small"
                    fluid
                    :aria-label="spec.label"
                    @update:model-value="onNumberInput(spec, $event)"
                    @blur="onNumberBlur(spec)"
                    @keydown.enter="onNumberBlur(spec)"
                />
                <small class="help">{{ rangeText(spec) }}</small>
            </template>
            <Select
                v-else
                :model-value="params[spec.key]"
                :options="spec.options"
                option-label="label"
                option-value="value"
                size="small"
                fluid
                :aria-label="spec.label"
                @update:model-value="emit('update', { [spec.key]: $event })"
            />
        </LabelledFormField>
    </div>
</template>

<script setup lang="ts">
/**
 * Inspector fields generated from the parameter schema of a parametric asset (feature 002, T077, FR-032).
 * Values inside the range are emitted while typing or spinning (the store merges them into one undo step with the
 * key `params:<id>`); values outside are held until blur and then clamped with `completeParams`.
 */
import { computed, ref } from "vue";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { completeParams } from "@/assetLibrary/params";
import type { AssetDefinition, ParamSpec, ParamValues } from "@/assetLibrary/types";

type NumberSpec = Extract<ParamSpec, { type: "number" }>;

const props = defineProps<{
    definition: AssetDefinition;
    params: ParamValues;
}>();

const emit = defineEmits<{
    update: [partial: Partial<ParamValues>];
}>();

const specs = computed<ParamSpec[]>(() => (props.definition.source.type === "parametric" ? props.definition.source.params : []));

/** Out-of-range input waiting for blur, per key. */
const pending = new Map<string, number>();
/** Bumped to re-create a field whose display must snap back to the stored value. */
const resetToken = ref(0);

function numberValue(key: string): number | undefined {
    const value = props.params[key];
    return typeof value === "number" ? value : undefined;
}

function fractionDigits(step: number): number {
    const text = String(step);
    const dot = text.indexOf(".");
    return dot === -1 ? 0 : Math.min(6, text.length - dot - 1);
}

function suffix(unit: NumberSpec["unit"]): string | undefined {
    return unit === "m" ? " m" : unit === "deg" ? "°" : undefined;
}

function unitText(unit: NumberSpec["unit"]): string {
    return unit === "m" ? " m" : unit === "deg" ? "°" : "";
}

function rangeText(spec: NumberSpec): string {
    return `${spec.min} – ${spec.max}${unitText(spec.unit)}`;
}

function onNumberInput(spec: NumberSpec, value: number | null) {
    if (value === null || !Number.isFinite(value)) {
        return;
    }
    if (value < spec.min || value > spec.max) {
        pending.set(spec.key, value);
        return;
    }
    pending.delete(spec.key);
    if (value !== props.params[spec.key]) {
        emit("update", { [spec.key]: value });
    }
}

function onNumberBlur(spec: NumberSpec) {
    const value = pending.get(spec.key);
    pending.delete(spec.key);
    if (value === undefined) {
        return;
    }
    const clamped = completeParams(props.definition, { ...props.params, [spec.key]: value })[spec.key];
    if (clamped !== props.params[spec.key]) {
        emit("update", { [spec.key]: clamped });
    }
    // the field may still show the out-of-range text if the stored value did not change
    resetToken.value++;
}
</script>

<style scoped>
.parameter-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.5rem;
}

.help {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.75rem;
    opacity: 0.65;
}
</style>
