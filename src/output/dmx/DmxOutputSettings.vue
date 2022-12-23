<template>
    <div class="flex flex-col mt-4 gap-4">
        <LabelledInputText v-model="port">Port</LabelledInputText>
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
