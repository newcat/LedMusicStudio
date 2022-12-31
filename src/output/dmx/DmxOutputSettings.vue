<template>
    <div class="dmx-output-settings">
        <div>
            <TabMenu v-model:active-index="activeTab" :model="tabMenuItems" />
        </div>
        <div class="h-full">
            <div v-if="activeTab === 0" class="flex flex-col mt-4 gap-4">
                <LabelledInputText v-model="port">Port</LabelledInputText>
                <div class="flex gap-4">
                    <Button @click="apply">Apply</Button>
                    <Button @click="updateValues">Cancel</Button>
                </div>
            </div>
            <UniverseSettings v-else-if="activeTab === 1" :fixtures="output.fixtures"></UniverseSettings>
            <FixtureLibrary v-else-if="activeTab === 2" @add-fixture="addFixture"></FixtureLibrary>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";
import TabMenu, { TabMenuProps } from "primevue/tabmenu";

import LabelledInputText from "@/components/LabelledInputText.vue";
import { DmxOutput } from "./dmx.output";
import { DmxFixture } from "./fixture";
import UniverseSettings from "./UniverseSettings.vue";
import FixtureLibrary from "./FixtureLibrary.vue";
import { Fixture } from "./open-fixture";

const props = defineProps({
    output: { type: Object as () => DmxOutput, required: true },
});

const activeTab = ref(0);
const port = ref("");

const tabMenuItems: TabMenuProps["model"] = [
    { label: "Settings", icon: "mdi mdi-cog-outline" },
    { label: "Universe", icon: "mdi mdi-earth" },
    { label: "Library", icon: "mdi mdi-bookshelf" },
];

function updateValues() {
    port.value = props.output.port;
}

async function apply() {
    props.output.port = port.value;
    await props.output.update();
}

function addFixture(rawFixture: Fixture) {
    const fixture = new DmxFixture(rawFixture, 1);
    // TODO: Algorithm to find free channels
    /*let ranges: Array<{ start: number, end: number }> = [{ start: 1, end: 512 }];
    for (const f of fixtures.value) {
        const rangeIndex = ranges.findIndex(r => r.start <= f.startChannel && r.end >= f.startChannel);
        const range = ranges[rangeIndex];
        
    }*/
    props.output.fixtures.push(fixture);
    activeTab.value = 1;
}

onMounted(updateValues);
</script>

<style scoped>
.dmx-output-settings {
    margin-bottom: 1rem;
    height: calc(100% - 1rem);
    width: 100%;
    display: grid;
    grid-template-rows: min-content minmax(0, 1fr);
}
</style>
