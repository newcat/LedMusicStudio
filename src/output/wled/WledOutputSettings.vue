<template>
    <div>
        <div class="field">
            <label for="host">Host</label>
            <InputText v-model="host" id="host" type="text" />
        </div>
        <div class="field">
            <label for="port">Port</label>
            <InputText v-model="port" id="port" type="text" />
        </div>
        <div class="field">
            <label for="timeout">Timeout</label>
            <InputText v-model="timeout" id="timeout" type="text" />
        </div>
        <div class="field">
            <label for="ledCount">Led Count</label>
            <InputText v-model="numLeds" id="ledCount" type="text" />
        </div>
        <Button @click="apply">Apply</Button>
        <Button @click="updateValues">Cancel</Button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import InputText from "primevue/inputtext";
import Button from "primevue/button";

import { WledOutput } from "./wled.output";

const props = defineProps({
    output: { type: Object as () => WledOutput, required: true },
});

const host = ref("");
const port = ref("");
const timeout = ref("");
const numLeds = ref("");

function updateValues() {
    host.value = props.output.state.host;
    port.value = props.output.state.port.toString();
    timeout.value = props.output.state.timeout.toString();
    numLeds.value = props.output.state.numLeds.toString();
}

function apply() {
    props.output.applyState({
        host: host.value,
        port: parseInt(port.value, 10),
        timeout: parseInt(timeout.value, 10),
        numLeds: parseInt(numLeds.value, 10),
    });
    updateValues();
}

onMounted(updateValues);
</script>

<style lang="css" scoped>
.settings-container {
    max-width: 30em;
}
</style>
