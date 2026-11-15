<template>
    <div class="slider-field">
        <Slider :model-value="model" :min="min" :max="max" :step="step" class="slider" @update:model-value="onSlider" />
        <InputNumber
            :model-value="model"
            :min="min"
            :max="max"
            :step="step"
            :suffix="suffix"
            :min-fraction-digits="0"
            :max-fraction-digits="fractionDigits ?? 2"
            size="small"
            class="number"
            :input-style="{ width: '100%' }"
            @update:model-value="onNumber"
        />
    </div>
</template>

<script setup lang="ts">
import Slider from "primevue/slider";
import InputNumber from "primevue/inputnumber";

/** Slider and number input in one row (feature 006): edge softness, pixel size, intensity. */
defineProps<{
    min: number;
    max: number;
    step: number;
    suffix?: string;
    fractionDigits?: number;
}>();

const model = defineModel<number>({ required: true });

function onSlider(value: number | number[]) {
    if (typeof value === "number") {
        model.value = value;
    }
}

function onNumber(value: number | null) {
    if (value !== null && Number.isFinite(value)) {
        model.value = value;
    }
}
</script>

<style scoped>
.slider-field {
    display: flex;
    align-items: center;
    gap: var(--insp-gap-3, 12px);
    min-width: 0;
}

.slider {
    flex: 1;
    min-width: 0;
}

.number {
    width: 4.5rem;
    flex-shrink: 0;
}
</style>
