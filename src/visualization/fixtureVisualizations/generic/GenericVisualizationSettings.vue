<template>
    <Fieldset legend="Channel Mapping" toggleable>
        <InterimCapabilityMapping v-model:mapping="config.mapping" :fixture="controller.fixture" :keys="KEYS" />
        <div class="text-sm opacity-70 mt-2">White when no color channel is mapped, full output when no dimmer channel is mapped.</div>
    </Fieldset>
</template>

<script setup lang="ts">
import Fieldset from "primevue/fieldset";

import { DmxFixture } from "@/stage";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import type { CapabilityKey } from "@/visualization/capabilities/types";
import { useLiveConfig } from "../useLiveConfig";
import InterimCapabilityMapping from "../InterimCapabilityMapping.vue";
import { GenericVisualizationConfig } from "./types";

defineOptions({ inheritAttrs: false });

const KEYS: CapabilityKey[] = ["dimmer", "red", "green", "blue", "white"];

const rawConfig = defineModel<GenericVisualizationConfig>("config", { required: true });

defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const config = useLiveConfig(rawConfig, (value) => (rawConfig.value = value));
</script>
