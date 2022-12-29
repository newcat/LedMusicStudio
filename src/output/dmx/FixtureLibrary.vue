<template>
    <div class="fixture-library">
        <div class="flex">
            <Button label="Add to Universe" :disabled="!selectedFixture" @click="addToUniverse" />
            <div class="grow"></div>
            <Button class="p-button-outlined" label="Update Fixture Library" @click="fixtureLibrary.updateFixtures" />
        </div>
        <Listbox
            class="fixture-list"
            v-model="selectedFixture"
            :options="fixtureLibrary.fixtures"
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
import { useFixtureLibrary } from "./fixtureLibrary";
import { Fixture } from "./open-fixture";

const emit = defineEmits<{
    (e: "addFixture", fixture: Fixture): void;
}>();

const fixtureLibrary = useFixtureLibrary();

const selectedFixture = ref<Fixture | null>(null);

function addToUniverse() {
    emit("addFixture", selectedFixture.value!);
}
</script>

<style scoped>
.fixture-library {
    margin-top: 1rem;
    height: calc(100% - 1rem);
    display: grid;
    grid-template-rows: min-content auto;
    gap: 1rem;
}

.fixture-list {
    min-height: 10rem;
    max-height: 100%;
    overflow-y: hidden;
}
</style>
