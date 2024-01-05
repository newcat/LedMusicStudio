<template>
    <Panel header="Channels">
        <div class="channels">
            <div
                v-for="fixture in fixtures"
                :key="fixture.id"
                v-tooltip.top="
                    `${fixture.name} (${fixture.config.startChannel} - ${fixture.config.startChannel + fixture.usedChannels.length - 1})`
                "
                class="fixture"
                :style="{
                    'grid-column-start': fixture.config.startChannel,
                    'grid-column-end': fixture.config.startChannel + fixture.usedChannels.length,
                }"
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
import { DmxFixture } from "../../fixtures";

defineProps<{
    fixtures: DmxFixture[];
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
    background-color: var(--primary-color);
    grid-row: 1;
    cursor: pointer;
    transition: background-color 0.1s linear;
}
</style>
