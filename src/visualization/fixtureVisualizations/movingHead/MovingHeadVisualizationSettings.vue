<template>
    <Fieldset legend="Channel Mapping" toggleable>
        <InterimCapabilityMapping v-model:mapping="config.mapping" :fixture="controller.fixture" :keys="KEYS" />
    </Fieldset>
</template>

<script setup lang="ts">
import Fieldset from "primevue/fieldset";

import { DmxFixture } from "@/stage";
import { useLiveConfig } from "../useLiveConfig";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import type { CapabilityKey } from "@/visualization/capabilities/types";
import type { BeamVisualizationConfig } from "../beam/types";
import InterimCapabilityMapping from "../InterimCapabilityMapping.vue";

defineOptions({ inheritAttrs: false });

const KEYS: CapabilityKey[] = ["pan", "tilt", "zoom", "dimmer", "red", "green", "blue", "white"];

const rawConfig = defineModel<BeamVisualizationConfig>("config", { required: true });

defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const config = useLiveConfig(rawConfig, (value) => (rawConfig.value = value));
</script>
