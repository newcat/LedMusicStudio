<template>
    <div class="settings">
        <LabelledInputText v-model="host">Host</LabelledInputText>
        <LabelledInputText v-model="port">Port</LabelledInputText>
        <LabelledInputText v-model="timeout">Timeout</LabelledInputText>
        <LabelledInputText v-model="numLeds">Led Count</LabelledInputText>
        <div class="flex gap-4">
            <Button @click="apply">Apply</Button>
            <Button @click="updateValues">Cancel</Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";

import LabelledInputText from "@/components/LabelledInputText.vue";
import { WledOutput } from "./wled.output";

const props = defineProps({
    output: { type: Object as () => WledOutput, required: true },
});

const host = ref("");
const port = ref("");
const timeout = ref("");
const numLeds = ref("");

function updateValues() {
    host.value = props.output.host;
    port.value = props.output.port.toString();
    timeout.value = props.output.timeout.toString();
    numLeds.value = props.output.numLeds.toString();
}

function apply() {
    props.output.host = host.value;
    props.output.port = parseInt(port.value, 10);
    props.output.timeout = parseInt(timeout.value, 10);
    props.output.numLeds = parseInt(numLeds.value, 10);
    props.output.update();
    updateValues();
}

onMounted(updateValues);
</script>

<style lang="css" scoped>
.settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
}
</style>
