<template>
    <div class="fixture-library">
        <div class="toolbar">
            <Button
                class="p-button-outlined"
                :disabled="updatingFixtureLibrary"
                label="Update Fixture Library"
                @click="updateFixtureLibrary"
            />
            <div class="grow"></div>
            <Button label="Add to Universe" :disabled="!selectedFixture" @click="addToUniverse" />
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
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Listbox from "primevue/listbox";
import { useToast } from "primevue/usetoast";
import { Manufacturer, useFixtureLibrary } from "./fixtureLibrary";
import { Fixture } from "./open-fixture";

const emit = defineEmits<{
    (e: "addFixture", fixture: Fixture): void;
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
    emit("addFixture", selectedFixture.value!);
}
</script>

<style scoped>
.fixture-library {
    margin-top: 1rem;
    height: calc(100% - 1rem);
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

.manufacturer-list {
    min-height: 10rem;
    max-height: 100%;
    overflow-y: hidden;
    grid-area: manufacturer-list;
}

.fixture-list {
    min-height: 10rem;
    max-height: 100%;
    overflow-y: hidden;
    grid-area: fixture-list;
}
</style>
