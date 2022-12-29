<template>
    <div class="output-editor">
        <component v-if="outputSettingsComponent" :is="outputSettingsComponent" :output="output.outputInstance" />
        <div v-else class="empty">
            <div>This output has no configuration</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ComponentOptions, computed } from "vue";

import { OutputType } from "./outputTypes";
import { OutputLibraryItem } from "./output.libraryItem";

import WledOutputSettings from "./wled/WledOutputSettings.vue";
import DmxOutputSettings from "./dmx/DmxOutputSettings.vue";

const outputSettingsComponentMapping: Record<OutputType, ComponentOptions<any> | undefined> = {
    [OutputType.DUMMY]: undefined,
    [OutputType.WLED]: WledOutputSettings,
    [OutputType.DMX]: DmxOutputSettings,
    [OutputType.RAZER_CHROMA]: undefined,
};

const props = defineProps({
    output: { type: Object as () => OutputLibraryItem, required: true },
});

const outputSettingsComponent = computed(() => {
    return outputSettingsComponentMapping[props.output.outputInstance.type];
});
</script>

<style lang="scss" scoped>
.output-editor {
    margin: 1rem;
    margin-bottom: 0;
    width: calc(100% - 2rem);
    height: calc(100% - 1rem);
}

.empty {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2rem;
}
</style>
