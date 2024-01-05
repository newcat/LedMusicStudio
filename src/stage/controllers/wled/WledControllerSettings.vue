<template>
    <LabelledInputText v-model="controller.config.host">Host</LabelledInputText>
    <LabelledFormField label="Port">
        <InputNumber v-model="controller.config.port" :min="0" :max="65535" :useGrouping="false" />
    </LabelledFormField>
    <LabelledFormField label="Timeout">
        <InputNumber v-model="controller.config.timeout" :min="0" :max="255" />
    </LabelledFormField>
</template>

<script setup lang="ts">
import InputNumber from "primevue/inputnumber";

import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { WledController } from "./wled.controller";

const controller = defineModel<WledController>({ required: true });
</script>
