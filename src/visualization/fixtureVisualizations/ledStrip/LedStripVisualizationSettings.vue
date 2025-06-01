<template>
    <LabelledFormField label="Intensity">
        <InputNumber v-model="config.intensity" :max-fraction-digits="5" />
    </LabelledFormField>
    <div class="flex gap-3">
        <LabelledFormField label="Start X">
            <InputNumber v-model="config.start[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Start Y">
            <InputNumber v-model="config.start[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Start Z">
            <InputNumber v-model="config.start[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="flex gap-3">
        <LabelledFormField label="End X">
            <InputNumber v-model="config.end[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="End Y">
            <InputNumber v-model="config.end[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="End Z">
            <InputNumber v-model="config.end[2]" :max-fraction-digits="3" />
        </LabelledFormField>
    </div>
    <div class="flex gap-3">
        <LabelledFormField label="Direction X">
            <InputNumber v-model="config.direction[0]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Direction Y">
            <InputNumber v-model="config.direction[1]" :max-fraction-digits="3" />
        </LabelledFormField>
        <LabelledFormField label="Direction Z">
            <InputNumber v-model="config.direction[2]" :max-fraction-digits="3" />
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

import { LedStripVisualizationConfig } from "./types";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
    config: LedStripVisualizationConfig;
}>();

const emit = defineEmits<{
    "update:config": [LedStripVisualizationConfig];
}>();

const { clone: config, dirty } = useEditClone(toRef(props, "config"));

const save = () => {
    emit("update:config", config.value);
    dirty.value = false;
};
</script>
