<template>
    <div class="output-editor">
        <n-select :value="output.outputInstance.type" :options="outputTypes" @update:value="onOutputTypeChanged" />
        <component v-if="outputSettingsComponent" :is="outputSettingsComponent" :output="output.outputInstance" />
    </div>
</template>

<script setup lang="ts">
import { ComponentOptions, computed } from "vue";
import { NSelect } from "naive-ui";

import { OutputType } from "./outputTypes";
import { OutputLibraryItem } from "./output.libraryItem";

import WledOutputSettings from "./wled/WledOutputSettings.vue";
import DmxOutputSettings from "./dmx/DmxOutputSettings.vue";
import { createOutput } from "./outputFactory";

const outputSettingsComponentMapping: Record<OutputType, ComponentOptions<any> | undefined> = {
    [OutputType.DUMMY]: undefined,
    [OutputType.WLED]: WledOutputSettings,
    [OutputType.DMX]: DmxOutputSettings,
    [OutputType.RAZER_CHROMA]: undefined,
};

const props = defineProps({
    output: { type: Object as () => OutputLibraryItem, required: true },
});

const outputTypes = [
    { label: "Dummy", value: OutputType.DUMMY },
    { label: "WLED", value: OutputType.WLED },
    { label: "DMX", value: OutputType.DMX },
    { label: "Razer Chroma", value: OutputType.RAZER_CHROMA },
];

const outputSettingsComponent = computed(() => {
    return outputSettingsComponentMapping[props.output.outputInstance.type];
});

async function onOutputTypeChanged(newOutputType: OutputType) {
    await props.output.outputInstance.destroy();
    props.output.outputInstance = createOutput(newOutputType);
}
</script>

<style lang="scss" scoped>
.output-editor {
    margin: 1em;
}
</style>
