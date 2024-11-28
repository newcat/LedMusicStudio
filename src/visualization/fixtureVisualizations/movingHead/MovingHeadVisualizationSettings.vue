<template>
    <Fieldset legend="Placement">
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
    <Fieldset legend="Channel Mapping">
        <div class="channel-mapping-grid">
            <ChannelMapping label="Pan" v-model="config.channelMapping.pan" :fixture="controller.fixture" />
            <ChannelMapping label="Tilt" v-model="config.channelMapping.tilt" :fixture="controller.fixture" />
            <ChannelMapping label="Beam Angle" v-model="config.channelMapping.beamAngle" :fixture="controller.fixture" />
            <ChannelMapping label="Red" v-model="config.channelMapping.red" :fixture="controller.fixture" />
            <ChannelMapping label="Green" v-model="config.channelMapping.green" :fixture="controller.fixture" />
            <ChannelMapping label="Blue" v-model="config.channelMapping.blue" :fixture="controller.fixture" />
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

defineOptions({ inheritAttrs: false });

const rawConfig = defineModel<MovingHeadVisualizationConfig>("config", { required: true });

defineProps<{
    controller: FixtureVisualizationController<DmxFixture>;
}>();

const { clone: config, dirty } = useEditClone(rawConfig);

const save = () => {
    rawConfig.value = config.value;
    dirty.value = false;
};
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
