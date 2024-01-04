<template>
    <div class="flex gap-3">
        <LabelledFormField label="Position X">
            <InputNumber v-model="fixture.position[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Position Y">
            <InputNumber v-model="fixture.position[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Position Z">
            <InputNumber v-model="fixture.position[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="flex gap-3">
        <LabelledFormField label="Target X">
            <InputNumber v-model="fixture.target[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Target Y">
            <InputNumber v-model="fixture.target[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Target Z">
            <InputNumber v-model="fixture.target[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="flex gap-3">
        <LabelledFormField label="DMX Channel Red">
            <InputNumber v-model="fixture.colorChannels[0]" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel Green">
            <InputNumber v-model="fixture.colorChannels[1]" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel Blue">
            <InputNumber v-model="fixture.colorChannels[2]" />
        </LabelledFormField>
    </div>
</template>

<script setup lang="ts">
import InputNumber from "primevue/inputnumber";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { StageLibraryItem } from "../../stage.libraryItem";
import { SpotStageFixture } from "./spot.fixture";

const props = defineProps<{
    stage: StageLibraryItem;
}>();

const fixture = defineModel<SpotStageFixture>({ required: true });
</script>

<style scoped></style>
