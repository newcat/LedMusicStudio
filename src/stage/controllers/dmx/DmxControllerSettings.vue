<template>
    <LabelledInputText v-model="controller.config.port">Port</LabelledInputText>
</template>

<script setup lang="ts">
import LabelledInputText from "@/components/LabelledInputText.vue";
import { DmxController } from "./dmx.controller";

const controller = defineModel<DmxController>({ required: true });
</script>
