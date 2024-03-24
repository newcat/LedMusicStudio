<template>
    <Dialog v-model:visible="visible" modal header="DMX Control Panel" style="width: 75vw; min-width: 1000px">
        <div class="dmx-control-panel">
            <div class="header">
                <div>Fixture:</div>
                <Dropdown v-model="selectedFixture" :options="controller.controlledFixtures" option-label="name" />
            </div>
            <div class="sliders">
                <template v-if="selectedFixture">
                    <div v-for="(channel, i) in selectedFixture.channelNames" :key="channel" class="channel">
                        <div>{{ channel }}</div>
                        <Slider
                            :model-value="selectedFixture.value[i]"
                            class="h-full"
                            orientation="vertical"
                            :min="0"
                            :max="255"
                            :step="1"
                            @update:model-value="setValue(i, $event)"
                        />
                        <div class="flex gap-2">
                            <Button text icon="pi pi-minus" @click="setValue(i, selectedFixture.value[i] - 1)" />
                            <Button text icon="pi pi-plus" @click="setValue(i, selectedFixture.value[i] + 1)" />
                        </div>
                        <div>{{ selectedFixture.value[i] ?? 0 }}</div>
                    </div>
                </template>
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";
import Dropdown from "primevue/dropdown";
import Dialog from "primevue/dialog";
import Slider from "primevue/slider";
import { DmxController } from "./dmx.controller";
import { DmxFixture } from "../../fixtures";
import { useThrottleFn } from "@vueuse/core";

const visible = defineModel<boolean>("visible", { required: true });

const props = defineProps<{
    controller: DmxController;
}>();

const selectedFixture = ref<DmxFixture>();

onMounted(() => {
    selectedFixture.value = props.controller.controlledFixtures[0];
});

const throttledSend = useThrottleFn(
    () => {
        void props.controller.send();
    },
    300,
    true
);

function setValue(index: number, value: number) {
    if (!selectedFixture.value) {
        return;
    }

    const clone = [...selectedFixture.value.value];
    clone[index] = value;
    selectedFixture.value.setValue(clone);
    void throttledSend();
}
</script>

<style scoped>
.dmx-control-panel {
    display: flex;
    flex-direction: column;
    gap: 1em;
}

.header {
    display: flex;
    align-items: center;
    gap: 1em;
}

.sliders {
    display: grid;
    height: 35vh;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    justify-content: center;
    gap: 1em;
}

.channel {
    min-width: 3.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1em;
}
</style>
