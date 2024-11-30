<template>
    <div class="timeline-container">
        <div class="timeline-toolbar">
            <Button outlined size="small" @click="() => editor.addDefaultTrack()">Add Track</Button>
            <Divider layout="vertical" />
            <span class="mr-4 mdi mdi-ruler" style="font-size: 1.5em"></span>
            <Select
                :model-value="snapUnits"
                :options="snapItems"
                option-label="label"
                option-value="value"
                style="width: 9em"
                @update:model-value="setSnap"
            ></Select>
            <Divider layout="vertical" />
            <div class="mr-4">BPM</div>
            <InputText :model-value="bpm" style="max-width: 4em" @update:model-value="(v) => setBpm(v ?? '0')"></InputText>
            <ToggleButton
                v-model="globalState.metronome"
                class="ml-4"
                on-icon="mdi mdi-metronome"
                off-icon="mdi mdi-metronome"
                on-label="Metronome"
                off-label="Metronome"
            ></ToggleButton>
            <div class="__spacer"></div>
            <span class="mr-4 mdi mdi-volume-high" style="font-size: 1.5em"></span>
            <Slider
                :model-value="volume * 100"
                :min="0"
                :max="100"
                style="width: 7em"
                @update:model-value="v => setVolume(v as number)"
            ></Slider>
        </div>
        <div id="wrapper">
            <timeline-base></timeline-base>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Button from "primevue/button";
import Divider from "primevue/divider";
import Slider from "primevue/slider";
import ToggleButton from "primevue/togglebutton";
import Select, { SelectProps } from "primevue/select";
import InputText from "primevue/inputtext";

import { TICKS_PER_BEAT } from "@/constants";
import { useGlobalState } from "@/globalState";
import TimelineBase from "./components/Timeline.vue";

const globalState = useGlobalState();

const snapItems: SelectProps["options"] = [
    { label: "Disabled", value: "1" },
    { label: "1/8 Beat", value: (TICKS_PER_BEAT / 8).toString() },
    { label: "1/6 Beat", value: (TICKS_PER_BEAT / 6).toString() },
    { label: "1/4 Beat", value: (TICKS_PER_BEAT / 4).toString() },
    { label: "1/3 Beat", value: (TICKS_PER_BEAT / 3).toString() },
    { label: "1/2 Beat", value: (TICKS_PER_BEAT / 2).toString() },
    { label: "1 Beat", value: TICKS_PER_BEAT.toString() },
    { label: "2 Beats", value: (2 * TICKS_PER_BEAT).toString() },
    { label: "4 Beats", value: (4 * TICKS_PER_BEAT).toString() },
    { label: "8 Beats", value: (8 * TICKS_PER_BEAT).toString() },
];

const editor = computed(() => {
    return globalState.timeline;
});

const volume = computed(() => {
    return globalState.volume;
});

const bpm = computed(() => {
    return globalState.bpm.toString();
});

const snapUnits = computed(() => {
    return globalState.snapUnits.toString();
});

function setVolume(v: number) {
    globalState.volume = Math.max(0, Math.min(1, v / 100));
}

function setBpm(v: string) {
    globalState.bpm = parseInt(v, 10);
}

function setSnap(value: string) {
    globalState.snapUnits = parseInt(value, 10);
}
</script>

<style scoped>
.timeline-container {
    display: flex;
    flex-direction: column;
    height: 100%;
}

#wrapper {
    flex-grow: 1;
    overflow: hidden;
}

.timeline-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--p-menubar-background);
    border-bottom: 1px solid var(--p-menubar-border-color);
}

.timeline-toolbar .__spacer {
    flex-grow: 1;
}
</style>
