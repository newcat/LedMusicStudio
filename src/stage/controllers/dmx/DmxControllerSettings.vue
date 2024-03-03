<template>
    <LabelledInputText v-model="port">Port</LabelledInputText>
    <ChannelVisualization :fixtures="controller.controlledFixtures" />
    <div>
        <Button outlined label="Open DMX Panel" @click="panelVisible = true" />
    </div>
    <DmxPanel :controller="controller" v-model:visible="panelVisible" />
</template>

<script setup lang="ts">
import { ref, toRef } from "vue";
import Button from "primevue/button";

import LabelledInputText from "@/components/LabelledInputText.vue";
import { useConfigProperties } from "../utils";
import { DmxController } from "./dmx.controller";
import ChannelVisualization from "./ChannelVisualization.vue";
import DmxPanel from "./DmxPanel.vue";

const props = defineProps<{
    controller: DmxController;
}>();

const { port } = useConfigProperties(toRef(props, "controller"));

const panelVisible = ref(false);
</script>
