<template>
    <Dropdown class="dmx-channel-selector" v-model="selectedChannel" :options="options" option-label="label" option-value="value" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Dropdown from "primevue/dropdown";

import { DmxFixture } from "@/stage/fixtures";

const selectedChannel = defineModel<number>({ required: true });

const props = defineProps<{
    fixture: DmxFixture;
}>();

const options = computed(() => {
    const options: { label: string; value: number }[] = [{ label: "None", value: -1 }];
    for (let i = 0; i < props.fixture.channelNames.length; i++) {
        options.push({
            label: props.fixture.channelNames[i],
            value: i,
        });
    }
    return options;
});
</script>

<style scoped>
.dmx-channel-selector {
    min-width: 10rem;
}
</style>
