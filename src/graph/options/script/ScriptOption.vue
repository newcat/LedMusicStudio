<template>
    <div>
        <h3>Inputs</h3>
        <Button label="Add Input" text @click="addInput" />
        <InterfaceView
            v-for="(input, key) in inputs"
            :key="key"
            :intf="input"
            class="mt-3"
            @rename="(n) => renameInput(key as string, n)"
            @remove="removeInput(key as string)"
        />

        <Divider />

        <h3 class="mt-3">Function</h3>
        <CodeEditor :model-value="intf.node.code" @update:model-value="updateCode" />

        <Divider />

        <h3 class="mt-3">Outputs</h3>
        <Button label="Add Output" text @click="addOutput" />
        <InterfaceView
            v-for="(output, key) in intf.node.outputs"
            :key="key"
            :intf="output"
            class="mt-3"
            @rename="(n) => renameOutput(key as string, n)"
            @remove="removeOutput(key as string)"
        />
    </div>
</template>

<script setup lang="ts">
import Button from "primevue/button";
import Divider from "primevue/divider";

import InterfaceView from "./InterfaceView.vue";
import { ScriptNodeConfigurationInterface } from "../../interfaces";
import { computed, defineAsyncComponent } from "vue";

const CodeEditor = defineAsyncComponent(() => import("./CodeEditor.vue"));

const props = defineProps<{
    intf: ScriptNodeConfigurationInterface;
}>();

const inputs = computed(() => {
    // filter out the two default interfaces
    return Object.fromEntries(Object.entries(props.intf.node.inputs).filter(([key]) => key !== "openSidebar" && key !== "config"));
});

function updateCode(code: string) {
    props.intf.node.code = code;
    props.intf.node.codeChangedSinceLastCalculate = true;
}

function addInput() {
    props.intf.node.addScriptInput("New Input");
}

function addOutput() {
    props.intf.node.addScriptOutput("New Output");
}

function renameInput(key: string, name: string) {
    props.intf.node.inputs[key].name = name;
}

function renameOutput(key: string, name: string) {
    props.intf.node.outputs[key].name = name;
}

function removeInput(key: string) {
    props.intf.node.removeScriptInput(key);
}

function removeOutput(key: string) {
    props.intf.node.removeScriptOutput(key);
}
</script>
