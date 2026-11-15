<template>
    <div class="position-readout" title="Playhead position (bar.beat · m:ss)">
        <span>{{ barBeat }}</span>
        <span class="__sep">·</span>
        <span>{{ minSec }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGlobalState } from "@/globalState";
import { formatBarBeat, formatMinSec, ticksToSeconds } from "../timeFormat";

/** Playhead position readout (feature 005, R14). */
const globalState = useGlobalState();

const barBeat = computed(() => formatBarBeat(globalState.position));
const minSec = computed(() => formatMinSec(ticksToSeconds(globalState.position, globalState.bpm)));
</script>

<style scoped>
.position-readout {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9rem;
    min-width: 7.5em;
    text-align: center;
    white-space: nowrap;
}
.__sep {
    opacity: 0.5;
    margin: 0 0.4em;
}
</style>
