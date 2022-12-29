<template>
    <div class="universe-settings">
        <Listbox v-model="selectedFixture" class="h-full" :options="fixtures" option-label="name" empty-message="No fixtures added. Go to the library to add one." />
        <FixtureSettings v-if="selectedFixture" :fixture="selectedFixture" />
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Listbox from "primevue/listbox";
import { DmxFixture } from "./fixture";
import FixtureSettings from "./FixtureSettings.vue";

const props = defineProps<{
    fixtures: DmxFixture[];
}>();

const selectedFixture = ref<DmxFixture | null>(null);
</script>

<style scoped>
.universe-settings {
    margin-top: 1rem;
    height: calc(100% - 1rem);
    display: grid;
    grid-template-columns: 20rem 3fr;
    gap: 1rem;
}
</style>
