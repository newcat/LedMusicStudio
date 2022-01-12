<template>
    <div class="fill-height">
        <toolbar>
            <n-button @click="() => editor.addDefaultTrack()">Add Track</n-button>
            <n-divider class="mx-4" vertical></n-divider>
            <n-icon>
                <volume-up-filled />
            </n-icon>
            <n-slider
                :value="volume * 100"
                @update:value="setVolume"
                :min="0"
                :max="100"
                :tooltip="false"
                style="max-width: 10em"
            ></n-slider>
            <n-divider class="mx-4" vertical></n-divider>
            <n-icon>
                <straighten-filled />
            </n-icon>
            <n-select
                :value="snapUnits"
                @update:value="setSnap"
                :options="snapItems"
                style="max-width: 12em"
                prepend-icon="straighten"
            ></n-select>
            <n-divider class="mx-4" vertical></n-divider>
            <div class="mr-2">BPM</div>
            <n-input :value="bpm" @update:value="setBpm" style="max-width: 6em"></n-input>
        </toolbar>
        <div id="wrapper">
            <timeline-base></timeline-base>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NDivider, NButton, NIcon, NSlider, NSelect, SelectOption, NInput } from "naive-ui";
import { VolumeUpFilled, StraightenFilled } from "@vicons/material";

import { TICKS_PER_BEAT } from "@/constants";
import { globalState } from "@/globalState";
import TimelineBase from "./components/Timeline.vue";
import Toolbar from "@/components/Toolbar.vue";

const snapItems: SelectOption[] = [
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
#wrapper {
    height: calc(100% - 48px);
    overflow: hidden;
}
</style>
