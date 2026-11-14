<template>
    <LabelledFormField label="Number of LEDs">
        <InputNumber v-model="numLeds" :min="1" :max="10000" />
    </LabelledFormField>
</template>

<script setup lang="ts">
import { computed } from "vue";
import InputNumber from "primevue/inputnumber";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { LedStripFixture } from "./ledStrip.fixture";

const props = defineProps<{
    fixture: LedStripFixture;
}>();

/** Through `setConfig`, so the visualization and controllers are notified of the new LED count. */
const numLeds = computed({
    get: () => props.fixture.config.numLeds,
    set: (value: number | null) => {
        const count = Math.max(1, Math.round(value ?? 1));
        if (count !== props.fixture.config.numLeds) {
            props.fixture.setConfig({ ...props.fixture.config, numLeds: count });
        }
    },
});
</script>
