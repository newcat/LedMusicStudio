<template>
    <div class="stage-settings">
        <div class="col-span-2">
            <div>
                <Button outlined icon="pi pi-plus" label="Add Fixture" @click="menu?.toggle"></Button>
                <Menu ref="menu" :model="addFixtureOptions" :popup="true"></Menu>
            </div>
        </div>
        <Listbox
            class="fixture-list"
            v-model="selectedFixture"
            :options="fixtures"
            option-label="name"
            empty-message="No fixtures added."
        />
        <Panel header="Fixture Settings"></Panel>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import Panel from "primevue/panel";
import Menu, { MenuProps } from "primevue/menu";

import { BaseStageFixture, StageFixture, StageFixtureType, WledStageFixture } from "./fixtures";

const fixtures = ref<BaseStageFixture[]>([]);
const selectedFixture = ref<BaseStageFixture | null>(null);
const menu = ref<Menu | null>(null);

const addFixtureOptions: MenuProps["model"] = [{ label: "WLED", icon: "mdi mdi-led-on", command: () => addFixture(StageFixtureType.WLED) }];

function addFixture(type: StageFixtureType) {
    let newFixture: StageFixture;
    switch (type) {
        case StageFixtureType.WLED:
            newFixture = {
                id: uuidv4(),
                type: StageFixtureType.WLED,
                name: "WLED Fixture",
                outputId: "",
                meshId: "",
            } satisfies WledStageFixture;
            break;
        default:
            throw new Error(`Unknown fixture type ${type}`);
    }
    fixtures.value.push(newFixture);
}
</script>

<style scoped>
.stage-settings {
    margin: 1rem;
    height: calc(100% - 2rem);
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: min-content auto;
}
</style>
