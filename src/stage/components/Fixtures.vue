<template>
    <div class="fixtures">
        <div class="col-span-2 flex gap-4">
            <div>
                <Button outlined icon="pi pi-plus" label="Add Fixture" @click="menu?.toggle"></Button>
                <Menu ref="menu" :model="addFixtureOptions" :popup="true"></Menu>
            </div>
        </div>
        <Listbox v-model="selectedFixture" :options="stage.fixtures.getArray()" empty-message="No fixtures added." scroll-height="">
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
        <Panel
            header="Fixture Settings"
            class="flex flex-col overflow-auto"
            :pt="{ contentContainer: { class: 'overflow-auto' }, content: { class: 'h-full' } }"
        >
            <template #icons>
                <Button
                    v-tooltip.left="'Clone Fixture'"
                    icon="pi pi-clone"
                    severity="secondary"
                    rounded
                    text
                    :disabled="!selectedFixture"
                    @click="cloneSelectedFixture"
                ></Button>
                <Button
                    v-tooltip.left="'Remove Fixture'"
                    icon="pi pi-trash"
                    severity="secondary"
                    rounded
                    text
                    :disabled="!selectedFixture"
                    @click="removeSelectedFixture"
                ></Button>
            </template>

            <FixtureSettings v-if="selectedFixture" :key="selectedFixture.id" :fixture="selectedFixture" />
        </Panel>
    </div>
</template>

<script setup lang="ts">
import { ComponentInstance, computed, reactive, ref } from "vue";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import Panel from "primevue/panel";
import Menu, { MenuProps } from "primevue/menu";

import { FixtureType, BaseFixture } from "../fixtures";
import { useStage } from "../stage";
import { useScene } from "@/scene/sceneStore";
import { selectedFixtureId } from "@/views/stageViewState";
import FixtureSettings from "./FixtureSettings.vue";
import { createFixture } from "../fixtures/factory";

const stage = useStage();
const scene = useScene();

// shared with the scene editor, so selecting a visualization there selects its fixture here (FR-026)
const selectedFixture = computed<BaseFixture | null>({
    get: () => (selectedFixtureId.value ? stage.fixtures.get(selectedFixtureId.value) ?? null : null),
    set: (fixture) => {
        selectedFixtureId.value = fixture?.id ?? null;
        const object = fixture ? scene.findObjectByFixture(fixture.id) : undefined;
        if (object) {
            scene.select([object.id], "replace");
        }
    },
});
const menu = ref<ComponentInstance<typeof Menu> | null>(null);

const addFixtureOptions: MenuProps["model"] = [
    { label: "LED Strip", icon: "mdi mdi-led-on", command: () => addFixture(FixtureType.LED_STRIP) },
    { label: "DMX", icon: "mdi mdi-audio-input-xlr", command: () => addFixture(FixtureType.DMX) },
];

function addFixture(type: FixtureType) {
    const newFixture = reactive(createFixture(type)) as BaseFixture;
    stage.fixtures.set(newFixture.id, newFixture);
    return newFixture;
}

function cloneSelectedFixture() {
    if (!selectedFixture.value) {
        return;
    }

    const newFixture = addFixture(selectedFixture.value.type);
    newFixture.setConfig(JSON.parse(JSON.stringify(selectedFixture.value.config)));
    newFixture.name = `${selectedFixture.value.name} (Copy)`;

    const controller = stage.controllers
        .getArray()
        .find((controller) => controller.controlledFixtures.some((f) => f.id === selectedFixture.value!.id));
    if (controller) {
        controller.addFixture(newFixture);
    }

    // the visualization object is not cloned: a fixture has at most one, and the copy gets its own via the editor
}

function removeSelectedFixture() {
    if (!selectedFixture.value) {
        return;
    }

    stage.fixtures.delete(selectedFixture.value.id);
    selectedFixtureId.value = null;
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
