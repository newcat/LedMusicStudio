<template>
    <Dialog v-model:visible="visible" modal header="Choose Fixture" style="width: 50vw; min-width: 1000px">
        <div class="fixture-library">
            <div class="toolbar">
                <Button
                    :icon="fixtureLibrary.updating ? 'pi pi-spin pi-spinner' : ''"
                    :disabled="fixtureLibrary.updating"
                    label="Update Fixture Library"
                    outlined
                    @click="updateFixtureLibrary"
                />
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
import { onMounted, ref } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import Listbox from "primevue/listbox";

import { useErrorHandler } from "@/utils";
import { Fixture } from "./open-fixture";
import { Manufacturer, useFixtureLibrary } from "./fixtureLibrary";

const visible = defineModel<boolean>({ required: true });
const emit = defineEmits<{
    (e: "setFixture", fixture: Fixture): void;
}>();

const fixtureLibrary = useFixtureLibrary();
const errorHandler = useErrorHandler();

const selectedManufacturer = ref<Manufacturer | null>(null);
const selectedFixture = ref<Fixture | null>(null);

onMounted(async () => {
    if (fixtureLibrary.fixtures.length === 0) {
        updateFixtureLibrary();
    }
});

async function updateFixtureLibrary() {
    await errorHandler("Failed to update fixture library", async () => {
        let data;
        try {
            data = await fixtureLibrary.downloadFromOfl();
        } catch (err) {
            console.error(err);
            data = await fixtureLibrary.downloadSelfHosted();
        }
        await fixtureLibrary.applyOflData(data);
    });
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
