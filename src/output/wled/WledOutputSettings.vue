<template>
    <div>
        <n-form-item label="Host">
            <n-input v-model="host"></n-input>
        </n-form-item>
        <n-form-item label="Port">
            <n-input v-model.number="port"></n-input>
        </n-form-item>
        <n-form-item label="Timeout">
            <n-input v-model.number="timeout"></n-input>
        </n-form-item>
        <n-form-item label="Led Count">
            <n-input v-model.number="numLeds"></n-input>
        </n-form-item>
        <n-button @click="apply">Apply</n-button>
        <n-button @click="updateValues">Cancel</n-button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NInput, NFormItem, NButton } from "naive-ui";
import { WledOutput } from "./wled.output";

const props = defineProps({
    output: { type: Object as () => WledOutput, required: true },
});

const host = ref("");
const port = ref(0);
const timeout = ref(0);
const numLeds = ref(0);

function updateValues() {
    host.value = props.output.state.host;
    port.value = props.output.state.port;
    timeout.value = props.output.state.timeout;
    numLeds.value = props.output.state.numLeds;
}

function apply() {
    props.output.applyState({
        host: host.value,
        port: port.value,
        timeout: timeout.value,
        numLeds: numLeds.value,
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
