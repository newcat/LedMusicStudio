<template>
    <LabelledInputText v-model="controller.config.port">Port</LabelledInputText>
    <ChannelVisualization :fixtures="controller.controlledFixtures" />
</template>

<script setup lang="ts">
import LabelledInputText from "@/components/LabelledInputText.vue";
import { DmxController } from "./dmx.controller";
import ChannelVisualization from "./ChannelVisualization.vue";

const controller = defineModel<DmxController>({ required: true });
</script>
