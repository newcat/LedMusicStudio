<template>
    <Dialog v-model:visible="visible" modal header="Choose Fixture" style="width: 50vw; min-width: 1000px">
        <div class="fixture-library">
            <div class="toolbar">
                <Button :disabled="updatingFixtureLibrary" label="Update Fixture Library" outlined @click="updateFixtureLibrary" />
            </div>
            <Listbox
                class="manufacturer-list"
                v-model="selectedManufacturer"
                :options="fixtureLibrary.fixtures"
                optionLabel="name"
                :filter="true"
                listStyle="max-height: 100%"
            ></Listbox>
            <Listbox
                class="fixture-list"
                v-model="selectedFixture"
                :options="selectedManufacturer?.fixtures ?? []"
                optionLabel="name"
                :filter="true"
                listStyle="max-height: 100%"
            ></Listbox>
        </div>

        <template #footer>
            <Button label="Ok" icon="pi pi-check" :disabled="!selectedFixture" @click="addToUniverse" />
            <Button label="Cancel" icon="pi pi-times" outlined @click="visible = false" />
        </template>
    </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import { useToast } from "primevue/usetoast";

import { Fixture } from "./open-fixture";
import { Manufacturer, useFixtureLibrary } from "./fixtureLibrary";

const visible = defineModel<boolean>({ required: true });
const emit = defineEmits<{
    (e: "setFixture", fixture: Fixture): void;
}>();

const toast = useToast();
const fixtureLibrary = useFixtureLibrary();

const updatingFixtureLibrary = ref(false);
const selectedManufacturer = ref<Manufacturer | null>(null);
const selectedFixture = ref<Fixture | null>(null);

async function updateFixtureLibrary() {
    updatingFixtureLibrary.value = true;
    try {
        await fixtureLibrary.updateFixtures();
    } catch (err) {
        console.error(err);
        toast.add({ severity: "error", life: 5000, summary: "Failed to update fixture library" });
    } finally {
        updatingFixtureLibrary.value = false;
    }
}

function addToUniverse() {
    emit("setFixture", selectedFixture.value!);
    visible.value = false;
}
</script>

<style scoped>
.fixture-library {
    margin-top: 1rem;
    height: 50vh;
    display: grid;
    gap: 1rem;
    grid-template-rows: min-content auto;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
        "toolbar toolbar"
        "manufacturer-list fixture-list";
}

.toolbar {
    display: flex;
    grid-area: toolbar;
}

.manufacturer-list,
.fixture-list {
    min-height: 10rem;
    max-height: 100%;
    overflow-y: hidden;
    display: flex;
    flex-direction: column;
}

.manufacturer-list {
    grid-area: manufacturer-list;
}

.fixture-list {
    grid-area: fixture-list;
}
</style>
