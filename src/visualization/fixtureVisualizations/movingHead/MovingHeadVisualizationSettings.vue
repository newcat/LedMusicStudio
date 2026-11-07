<template>
    <Fieldset legend="Channel Mapping" toggleable>
        <Button severity="secondary" outlined @click="autoAssignChannels">Auto-Assign</Button>
        <div class="channel-mapping-grid">
            <ChannelMapping v-model="config.channelMapping.pan" label="Pan" :fixture="controller.fixture" />
            <ChannelMapping v-model="config.channelMapping.tilt" label="Tilt" :fixture="controller.fixture" />
            <ChannelMapping v-model="config.channelMapping.beamAngle" label="Beam Angle" :fixture="controller.fixture" />
            <ChannelMapping v-model="config.channelMapping.red" label="Red" :fixture="controller.fixture" />
            <ChannelMapping v-model="config.channelMapping.green" label="Green" :fixture="controller.fixture" />
            <ChannelMapping v-model="config.channelMapping.blue" label="Blue" :fixture="controller.fixture" />
        </div>
    </Fieldset>
</template>

<script setup lang="ts">
import Fieldset from "primevue/fieldset";
import Button from "primevue/button";

import { DmxFixture } from "@/stage";
import { useLiveConfig } from "../useLiveConfig";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { MovingHeadVisualizationConfig } from "./movingHead.visualizationConfig";
import ChannelMapping from "../ChannelMapping.vue";
import { Capability } from "@/stage/fixtures/dmx/open-fixture";

defineOptions({ inheritAttrs: false });

const rawConfig = defineModel<MovingHeadVisualizationConfig>("config", { required: true });

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

    config.value.channelMapping.pan.channel = findCapabilityChannel((c) => c.type === "Pan");
    config.value.channelMapping.tilt.channel = findCapabilityChannel((c) => c.type === "Tilt");
    config.value.channelMapping.beamAngle.channel = findCapabilityChannel((c) => c.type === "Zoom" || c.type === "BeamAngle");
    config.value.channelMapping.red = findCapabilityChannel((c) => c.type === "ColorIntensity" && c.color === "Red");
    config.value.channelMapping.green = findCapabilityChannel((c) => c.type === "ColorIntensity" && c.color === "Green");
    config.value.channelMapping.blue = findCapabilityChannel((c) => c.type === "ColorIntensity" && c.color === "Blue");
}
</script>

<style scoped>
.channel-mapping-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-auto-rows: min-content;
    gap: 1rem;
    align-items: center;
}
</style>
