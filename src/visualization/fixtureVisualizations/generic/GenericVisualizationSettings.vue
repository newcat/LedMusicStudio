<template>
    <Fieldset legend="Channel Mapping" toggleable>
        <Button severity="secondary" outlined @click="autoAssignChannels">Auto-Assign</Button>
        <div class="channel-mapping-grid">
            <ChannelMapping v-model="config.channelMapping.intensity" label="Intensity" :fixture="controller.fixture" />
        </div>
        <div class="flex flex-wrap gap-3 mt-3">
            <LabelledFormField label="Red">
                <DmxChannelSelector v-model="config.channelMapping.red" :fixture="controller.fixture" />
            </LabelledFormField>
            <LabelledFormField label="Green">
                <DmxChannelSelector v-model="config.channelMapping.green" :fixture="controller.fixture" />
            </LabelledFormField>
            <LabelledFormField label="Blue">
                <DmxChannelSelector v-model="config.channelMapping.blue" :fixture="controller.fixture" />
            </LabelledFormField>
            <LabelledFormField label="White">
                <DmxChannelSelector v-model="config.channelMapping.white" :fixture="controller.fixture" />
            </LabelledFormField>
        </div>
        <div class="text-sm opacity-70 mt-2">White when no color channel is mapped, full output when no intensity channel is mapped.</div>
    </Fieldset>
</template>

<script setup lang="ts">
import Fieldset from "primevue/fieldset";
import Button from "primevue/button";

import { DmxFixture } from "@/stage";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { Capability } from "@/stage/fixtures/dmx/open-fixture";
import { useLiveConfig } from "../useLiveConfig";
import ChannelMapping from "../ChannelMapping.vue";
import DmxChannelSelector from "../DmxChannelSelector.vue";
import { GenericVisualizationConfig } from "./types";

defineOptions({ inheritAttrs: false });

const rawConfig = defineModel<GenericVisualizationConfig>("config", { required: true });

const props = defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const config = useLiveConfig(rawConfig, (value) => (rawConfig.value = value));

function autoAssignChannels() {
    const channels = props.controller.fixture.channelNames;
    const availableChannels = props.controller.fixture.config.definition?.availableChannels ?? {};

    function findCapabilityChannel(predicate: (capability: Capability) => boolean) {
        return channels.findIndex((channel) => {
            const channelDefinition = availableChannels[channel];
            if (!channelDefinition) {
                return false;
            }
            return (
                (channelDefinition.capability && predicate(channelDefinition.capability)) ||
                channelDefinition.capabilities?.some((c) => predicate(c))
            );
        });
    }

    config.value.channelMapping.intensity.channel = findCapabilityChannel((c) => c.type === "Intensity");
    config.value.channelMapping.red = findCapabilityChannel((c) => c.type === "ColorIntensity" && c.color === "Red");
    config.value.channelMapping.green = findCapabilityChannel((c) => c.type === "ColorIntensity" && c.color === "Green");
    config.value.channelMapping.blue = findCapabilityChannel((c) => c.type === "ColorIntensity" && c.color === "Blue");
    config.value.channelMapping.white = findCapabilityChannel((c) => c.type === "ColorIntensity" && c.color === "White");
}
</script>

<style scoped>
.channel-mapping-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-auto-rows: min-content;
    gap: 1rem;
    align-items: center;
    margin-top: 1rem;
}
</style>
