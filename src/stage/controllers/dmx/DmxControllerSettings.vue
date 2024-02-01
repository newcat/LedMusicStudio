<template>
    <LabelledInputText v-model="port">Port</LabelledInputText>
    <ChannelVisualization :fixtures="controller.controlledFixtures" />
</template>

<script setup lang="ts">
import { toRef } from "vue";

import LabelledInputText from "@/components/LabelledInputText.vue";
import { useConfigProperties } from "../utils";
import { DmxController } from "./dmx.controller";
import ChannelVisualization from "./ChannelVisualization.vue";

const props = defineProps<{
    controller: DmxController;
}>();

const { port } = useConfigProperties(toRef(props, "controller"));
</script>
