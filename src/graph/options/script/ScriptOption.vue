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
        <Panel header="How to write a script" toggleable collapsed class="mb-3 script-help">
            <p>The code is the body of a function that runs every time the graph is calculated.</p>
            <ul>
                <li><code>this.inputs.&lt;Name&gt;</code> – current value of the input called <i>Name</i>.</li>
                <li><code>this.state</code> – the state object you returned during the previous calculation (<code>{}</code> at first).</li>
            </ul>
            <p>
                The function <b>must</b> return an object with an <code>outputs</code> object containing a value for
                <b>every</b> output (keyed by output name), and optionally a <code>state</code> object. State is only kept if
                you return it – changes made to <code>this.state</code> without returning it are lost.
            </p>
            <pre>{{ exampleCode }}</pre>
        </Panel>
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
import Panel from "primevue/panel";

import InterfaceView from "./InterfaceView.vue";
import { ScriptNodeConfigurationInterface } from "../../interfaces";
import { computed, defineAsyncComponent } from "vue";

const CodeEditor = defineAsyncComponent(() => import("./CodeEditor.vue"));

const props = defineProps<{
    intf: ScriptNodeConfigurationInterface;
}>();

const exampleCode = `// Inputs: "Trigger" (Boolean), Outputs: "Random" (Number)
const state = { ...this.state };

if (this.inputs.Trigger && !state.oldTrigger) {
  state.random = Math.random();
}
state.oldTrigger = this.inputs.Trigger;

return {
  outputs: { Random: state.random ?? 0 },
  state,
};`;

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

<style scoped>
.script-help p,
.script-help ul {
    margin: 0 0 0.5rem;
}

.script-help pre {
    margin: 0;
    padding: 0.5rem;
    overflow-x: auto;
    font-size: 0.85em;
    background: var(--p-content-hover-background, rgba(127, 127, 127, 0.15));
    border-radius: 4px;
}
</style>
