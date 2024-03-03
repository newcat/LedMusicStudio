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
                        <Slider v-model="selectedFixture.value[i]" class="h-full" orientation="vertical" :min="0" :max="255" :step="1" />
                        <div>{{ selectedFixture.value[i] ?? 0 }}</div>
                    </div>
                </template>
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Dropdown from "primevue/dropdown";
import Dialog from "primevue/dialog";
import Slider from "primevue/slider";
import { DmxController } from "./dmx.controller";
import { DmxFixture } from "../../fixtures";

const visible = defineModel<boolean>("visible", { required: true });

defineProps<{
    controller: DmxController;
}>();

const selectedFixture = ref<DmxFixture>();
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
