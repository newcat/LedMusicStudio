<template>
    <div>
        <div class="field">
            <label for="port">Port</label>
            <InputText v-model="port" id="port" type="text" />
        </div>
        <Button @click="apply">Apply</Button>
        <Button @click="updateValues">Cancel</Button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

import InputText from "primevue/inputtext";
import Button from "primevue/button";

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
