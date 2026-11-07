<template>
    <div class="flex gap-3">
        <LabelledFormField label="DMX Channel Red">
            <DmxChannelSelector v-model="config.colorChannels[0]" :fixture="controller.fixture" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel Green">
            <DmxChannelSelector v-model="config.colorChannels[1]" :fixture="controller.fixture" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel Blue">
            <DmxChannelSelector v-model="config.colorChannels[2]" :fixture="controller.fixture" />
        </LabelledFormField>
        <LabelledFormField label="DMX Channel White">
            <DmxChannelSelector v-model="config.colorChannels[3]" :fixture="controller.fixture" />
        </LabelledFormField>
    </div>
    <div class="text-sm opacity-70">The spot emits along the object's local -Y axis.</div>
</template>

<script setup lang="ts">
import { DmxFixture } from "@/stage";
import LabelledFormField from "@/components/LabelledFormField.vue";
import DmxChannelSelector from "../DmxChannelSelector.vue";
import { SpotVisualizationConfig } from "./types";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { useLiveConfig } from "../useLiveConfig";

defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const model = defineModel<SpotVisualizationConfig>("config", { required: true });
const config = useLiveConfig(model, (value) => (model.value = value));
</script>
