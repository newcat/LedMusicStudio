<template>
    <Fieldset legend="Channel Mapping" toggleable>
        <InterimCapabilityMapping v-model:mapping="config.mapping" :fixture="controller.fixture" :keys="KEYS" />
    </Fieldset>
    <div class="text-sm opacity-70">The spot emits along the model's beam direction.</div>
</template>

<script setup lang="ts">
import Fieldset from "primevue/fieldset";

import { DmxFixture } from "@/stage";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import type { CapabilityKey } from "@/visualization/capabilities/types";
import type { BeamVisualizationConfig } from "../beam/types";
import { useLiveConfig } from "../useLiveConfig";
import InterimCapabilityMapping from "../InterimCapabilityMapping.vue";

defineOptions({ inheritAttrs: false });

const KEYS: CapabilityKey[] = ["zoom", "dimmer", "red", "green", "blue", "white"];

defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const model = defineModel<BeamVisualizationConfig>("config", { required: true });
const config = useLiveConfig(model, (value) => (model.value = value));
</script>
