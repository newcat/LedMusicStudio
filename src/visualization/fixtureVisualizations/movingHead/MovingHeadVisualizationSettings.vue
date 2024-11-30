<template>
    <Fieldset legend="Placement" toggleable>
        <div class="flex gap-3">
            <LabelledFormField label="Position X">
                <InputNumber v-model="config.position[0]" :max-fraction-digits="3" />
            </LabelledFormField>
            <LabelledFormField label="Position Y">
                <InputNumber v-model="config.position[1]" :max-fraction-digits="3" />
            </LabelledFormField>
            <LabelledFormField label="Position Z">
                <InputNumber v-model="config.position[2]" :max-fraction-digits="3" />
            </LabelledFormField>
        </div>
        <div class="flex gap-3 mt-4">
            <LabelledFormField label="Rotation X">
                <InputNumber v-model="config.rotation[0]" :max-fraction-digits="3" />
            </LabelledFormField>
            <LabelledFormField label="Rotation Y">
                <InputNumber v-model="config.rotation[1]" :max-fraction-digits="3" />
            </LabelledFormField>
            <LabelledFormField label="Rotation Z">
                <InputNumber v-model="config.rotation[2]" :max-fraction-digits="3" />
            </LabelledFormField>
        </div>
    </Fieldset>
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
    <div>
        <Button outlined label="Apply" :disabled="!dirty" @click="save" />
    </div>
</template>

<script setup lang="ts">
import InputNumber from "primevue/inputnumber";
import Fieldset from "primevue/fieldset";
import Button from "primevue/button";

import { DmxFixture } from "@/stage";
import LabelledFormField from "@/components/LabelledFormField.vue";
import { useEditClone } from "@/utils";
import { FixtureVisualizationController } from "@/visualization/fixtureVisualizationController";
import { MovingHeadVisualizationConfig } from "./movingHead.visualizationConfig";
import ChannelMapping from "../ChannelMapping.vue";
import { Capability } from "@/stage/fixtures/dmx/open-fixture";

defineOptions({ inheritAttrs: false });

const rawConfig = defineModel<MovingHeadVisualizationConfig>("config", { required: true });

const props = defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const { clone: config, dirty } = useEditClone(rawConfig);

const save = () => {
    rawConfig.value = config.value;
    dirty.value = false;
};

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
