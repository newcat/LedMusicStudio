<template>
    <div class="flex gap-3">
        <LabelledFormField label="Position X">
            <InputNumber v-model="config.position[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Position Y">
            <InputNumber v-model="config.position[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Position Z">
            <InputNumber v-model="config.position[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="flex gap-3">
        <LabelledFormField label="Target X">
            <InputNumber v-model="config.target[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Target Y">
            <InputNumber v-model="config.target[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Target Z">
            <InputNumber v-model="config.target[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="flex gap-3">
        <LabelledFormField label="DMX Channel Red">
            <InputNumber v-model="config.colorChannels[0]" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel Green">
            <InputNumber v-model="config.colorChannels[1]" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel Blue">
            <InputNumber v-model="config.colorChannels[2]" />
        </LabelledFormField>
    </div>
    <div>
        <Button outlined label="Apply" :disabled="!dirty" @click="save" />
    </div>
</template>

<script setup lang="ts">
import { toRef } from "vue";
import InputNumber from "primevue/inputnumber";
import Button from "primevue/button";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { useEditClone } from "@/utils";
import { SpotVisualization } from "./spot.visualization";

const props = defineProps<{
    visualization: SpotVisualization;
}>();

const { clone: config, dirty } = useEditClone(toRef(props.visualization, "config"));

const save = () => {
    props.visualization.setConfig(config.value);
    dirty.value = false;
};
</script>

<style scoped></style>
