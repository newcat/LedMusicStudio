<template>
    <div class="fixtures">
        <div class="col-span-2 flex gap-4">
            <div>
                <Button outlined icon="pi pi-plus" label="Add Fixture" @click="menu?.toggle"></Button>
                <Menu ref="menu" :model="addFixtureOptions" :popup="true"></Menu>
            </div>
        </div>
        <Listbox v-model="selectedFixture" :options="stage.fixtures.getArray()" empty-message="No fixtures added.">
            <template #option="{ option }">
                <div class="flex align-items-center">
                    <i
                        v-if="option.validationErrors.length > 0"
                        class="mdi mdi-alert mr-4"
                        title="Please set all necessary options to use this fixture"
                    ></i>
                    <div>{{ option.name }}</div>
                </div>
            </template>
        </Listbox>
        <Panel header="Fixture Settings" class="flex flex-col" :pt="{ toggleableContent: { class: 'grow' }, content: { class: 'h-full' } }">
            <template #icons>
                <button
                    v-tooltip.left="'Remove Fixture'"
                    class="p-panel-header-icon p-link"
                    :disabled="!selectedFixture"
                    @click="removeSelectedFixture"
                >
                    <span class="pi pi-trash"></span>
                </button>
            </template>

            <FixtureSettings v-if="selectedFixture" :key="selectedFixture.id" :fixture="selectedFixture" />
        </Panel>
    </div>
</template>

<script setup lang="ts">
import { Ref, ref } from "vue";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import Panel from "primevue/panel";
import Menu, { MenuProps } from "primevue/menu";

import { FixtureType, BaseFixture } from "../fixtures";
import { useStage } from "../stage";
import FixtureSettings from "./FixtureSettings.vue";
import { createFixture } from "../fixtures/factory";

const stage = useStage();

const selectedFixture = ref<BaseFixture | null>(null) as Ref<BaseFixture | null>;
const menu = ref<Menu | null>(null);

const addFixtureOptions: MenuProps["model"] = [
    { label: "LED Strip", icon: "mdi mdi-led-on", command: () => addFixture(FixtureType.LED_STRIP) },
    { label: "DMX", icon: "mdi mdi-audio-input-xlr", command: () => addFixture(FixtureType.DMX) },
];

function addFixture(type: FixtureType) {
    const newFixture = createFixture(type);
    stage.fixtures.set(newFixture.id, newFixture);
}

function removeSelectedFixture() {
    if (!selectedFixture.value) {
        return;
    }

    stage.fixtures.delete(selectedFixture.value.id);
    selectedFixture.value = null;
}
</script>

<style scoped>
.fixtures {
    width: 100%;
    height: 100%;
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr 2fr;
    grid-template-rows: min-content auto;
}

.fixture-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
</style>
