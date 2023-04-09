<template>
    <div class="universe-settings">
        <Listbox
            v-model="selectedFixture"
            class="fixture-list"
            :options="fixtures"
            option-label="name"
            empty-message="No fixtures added. Go to the library to add one."
        />
        <FixtureSettings v-if="selectedFixture" class="u-fixture-settings" :fixture="selectedFixture" @remove="removeFixture" />
        <ChannelVisualization
            class="channel-visualization"
            v-model:selected-fixture="selectedFixture"
            :fixtures="fixtures"
        ></ChannelVisualization>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Listbox from "primevue/listbox";
import { DmxFixture } from "./fixture";
import FixtureSettings from "./FixtureSettings.vue";
import ChannelVisualization from "./ChannelVisualization.vue";

const props = defineProps<{
    fixtures: DmxFixture[];
}>();

const emit = defineEmits<{
    (e: "update:fixtures", fixtures: DmxFixture[]): void;
}>();

const selectedFixture = ref<DmxFixture | null>(null);

function removeFixture() {
    emit(
        "update:fixtures",
        props.fixtures.filter((f) => f !== selectedFixture.value)
    );
    selectedFixture.value = null;
}
</script>

<style scoped>
.universe-settings {
    margin-top: 1rem;
    height: calc(100% - 1rem);
    display: grid;
    gap: 1rem;
    grid-template-columns: 20rem 3fr;
    grid-template-rows: 1fr min-content;
    grid-template-areas:
        "fixture-list fixture-settings"
        "channel-visualization channel-visualization";
}

.fixture-list {
    grid-area: fixture-list;
    height: 100%;
}

.u-fixture-settings {
    grid-area: fixture-settings;
}

.channel-visualization {
    grid-area: channel-visualization;
}
</style>
