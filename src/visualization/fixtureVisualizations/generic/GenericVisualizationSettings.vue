<template>
    <PropertyRow label="Light surfaces" for="generic-surface-light">
        <div class="checkbox-row">
            <Checkbox v-model="config.surfaceLight" input-id="generic-surface-light" binary />
        </div>
    </PropertyRow>
    <PropertyRow v-if="config.surfaceLight" label="Light angle">
        <InputNumber v-model="config.lightAngle" :min="10" :max="170" suffix="°" size="small" fluid />
    </PropertyRow>
</template>

<script setup lang="ts">
import Checkbox from "primevue/checkbox";
import InputNumber from "primevue/inputnumber";

import PropertyRow from "@/scene/editor/inspector/PropertyRow.vue";
import { useLiveConfig } from "../useLiveConfig";
import { GenericVisualizationConfig } from "./types";

defineOptions({ inheritAttrs: false });

const rawConfig = defineModel<GenericVisualizationConfig>("config", { required: true });

const config = useLiveConfig(rawConfig, (value) => (rawConfig.value = value));
</script>

<style scoped>
.checkbox-row {
    display: flex;
    align-items: center;
    min-height: 2rem;
}
</style>
