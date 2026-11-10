<template>
    <Fieldset legend="Capability Mapping" toggleable>
        <CapabilityMappingEditor v-model:mapping="config.mapping" :type="controller.type" :controller="controller" />
    </Fieldset>
</template>

<script setup lang="ts">
import Fieldset from "primevue/fieldset";

import { DmxFixture } from "@/stage";
import { useLiveConfig } from "../useLiveConfig";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import type { BeamVisualizationConfig } from "../beam/types";
import CapabilityMappingEditor from "../CapabilityMappingEditor.vue";

defineOptions({ inheritAttrs: false });

const rawConfig = defineModel<BeamVisualizationConfig>("config", { required: true });

defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const config = useLiveConfig(rawConfig, (value) => (rawConfig.value = value));
</script>
