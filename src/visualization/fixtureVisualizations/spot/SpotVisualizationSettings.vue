<template>
    <Fieldset legend="Capability Mapping" toggleable>
        <CapabilityMappingEditor v-model:mapping="config.mapping" :type="controller.type" :controller="controller" />
    </Fieldset>
    <div class="text-sm opacity-70">The spot emits along the model's beam direction.</div>
</template>

<script setup lang="ts">
import Fieldset from "primevue/fieldset";

import { DmxFixture } from "@/stage";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import type { BeamVisualizationConfig } from "../beam/types";
import { useLiveConfig } from "../useLiveConfig";
import CapabilityMappingEditor from "../CapabilityMappingEditor.vue";

defineOptions({ inheritAttrs: false });

defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const model = defineModel<BeamVisualizationConfig>("config", { required: true });
const config = useLiveConfig(model, (value) => (model.value = value));
</script>
