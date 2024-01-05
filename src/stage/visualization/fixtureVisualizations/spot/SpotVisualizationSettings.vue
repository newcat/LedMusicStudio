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
            <DmxChannelSelector v-model="config.colorChannels[0]" :fixture="props.visualization.fixture" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel Green">
            <DmxChannelSelector v-model="config.colorChannels[1]" :fixture="props.visualization.fixture" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel Blue">
            <DmxChannelSelector v-model="config.colorChannels[2]" :fixture="props.visualization.fixture" />
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
import DmxChannelSelector from "../DmxChannelSelector.vue";

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
