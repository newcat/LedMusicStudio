<template>
    <div>
        <n-form-item label="Port">
            <n-input v-model="port"></n-input>
        </n-form-item>
        <n-button @click="apply">Apply</n-button>
        <n-button @click="updateValues">Cancel</n-button>
    </div>
</template>

<script setup lang="ts">
import { NInput, NFormItem, NButton } from "naive-ui";
import { onMounted, ref } from "vue";
import { DmxOutput } from "./dmx.output";

const props = defineProps({
    output: { type: Object as () => DmxOutput, required: true },
});

const port = ref("");

function updateValues() {
    port.value = props.output.state.port;
}

function apply() {
    props.output.applyState({
        port: port.value,
    });
    updateValues();
}

onMounted(updateValues);
</script>
