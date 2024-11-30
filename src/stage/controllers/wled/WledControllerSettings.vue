<template>
    <LabelledInputText v-model="host">Host</LabelledInputText>
    <LabelledFormField label="Port">
        <InputNumber v-model="port" :min="0" :max="65535" :use-grouping="false" />
    </LabelledFormField>
    <LabelledFormField label="Timeout">
        <InputNumber v-model="timeout" :min="0" :max="255" />
    </LabelledFormField>
</template>

<script setup lang="ts">
import { toRef } from "vue";
import InputNumber from "primevue/inputnumber";

import LabelledInputText from "@/components/LabelledInputText.vue";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { useConfigProperties } from "../utils";
import { WledController } from "./wled.controller";

const props = defineProps<{
    controller: WledController;
}>();

const { host, port, timeout } = useConfigProperties(toRef(props, "controller"));
</script>
