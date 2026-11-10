<template>
    <div class="flex gap-3 items-end">
        <div class="flex items-center gap-2 pb-2">
            <Checkbox v-model="config.surfaceLight" input-id="generic-surface-light" binary />
            <label for="generic-surface-light">Light surfaces</label>
        </div>
        <LabelledFormField v-if="config.surfaceLight" label="Light angle">
            <InputNumber v-model="config.lightAngle" :min="10" :max="170" suffix="°" />
        </LabelledFormField>
    </div>
    <Fieldset legend="Capability Mapping" toggleable>
        <CapabilityMappingEditor v-model:mapping="config.mapping" :type="controller.type" :controller="controller" :model-id="modelId" />
        <div class="text-sm opacity-70 mt-2">White when no color channel is mapped, full output when no dimmer channel is mapped.</div>
    </Fieldset>
</template>

<script setup lang="ts">
import Checkbox from "primevue/checkbox";
import Fieldset from "primevue/fieldset";
import InputNumber from "primevue/inputnumber";

import LabelledFormField from "@/components/LabelledFormField.vue";
import { DmxFixture } from "@/stage";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { useLiveConfig } from "../useLiveConfig";
import CapabilityMappingEditor from "../CapabilityMappingEditor.vue";
import { GenericVisualizationConfig } from "./types";

defineOptions({ inheritAttrs: false });

const rawConfig = defineModel<GenericVisualizationConfig>("config", { required: true });

defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
    /** Model of the visualization object (Auto-Assign fallbacks). */
    modelId?: string;
}>();

const config = useLiveConfig(rawConfig, (value) => (rawConfig.value = value));
</script>
