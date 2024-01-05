<template>
    <LabelledFormField label="Number of LEDs">
        <InputNumber v-model="fixture.config.numLeds" />
    </LabelledFormField>
</template>

<script setup lang="ts">
import InputNumber from "primevue/inputnumber";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { LedStripFixture } from "./ledStrip.fixture";

defineProps<{
    fixture: LedStripFixture;
}>();
</script>
