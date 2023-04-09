<template>
    <Panel header="Channels">
        <div class="channels">
            <div
                v-for="fixture in fixtures"
                v-tooltip.top="`${fixture.name} (${fixture.startChannel} - ${fixture.startChannel + fixture.usedChannels.length - 1})`"
                class="fixture"
                :class="{ '--selected': selectedFixture === fixture }"
                :style="{
                    'grid-column-start': fixture.startChannel,
                    'grid-column-end': fixture.startChannel + fixture.usedChannels.length,
                }"
                @click="emit('update:selectedFixture', fixture)"
            ></div>
        </div>
    </Panel>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import Tooltip from "primevue/tooltip";

export default defineComponent({
    directives: {
        Tooltip,
    },
});
</script>

<script setup lang="ts">
import Panel from "primevue/panel";
import { DmxFixture } from "./fixture";

defineProps<{
    fixtures: DmxFixture[];
    selectedFixture: DmxFixture | null;
}>();

const emit = defineEmits<{
    (e: "update:selectedFixture", fixture: DmxFixture): void;
}>();
</script>

<style scoped>
.channels {
    display: grid;
    grid-template-columns: repeat(512, 1fr);
    grid-template-rows: 1fr;
}

.fixture {
    height: 0.5rem;
    border-radius: 0.5rem;
    background-color: var(--surface-d);
    grid-row: 1;
    cursor: pointer;
    transition: background-color 0.1s linear;
}

.fixture.--selected {
    background-color: var(--primary-color);
}
</style>
