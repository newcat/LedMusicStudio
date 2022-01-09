<template lang="pug">
.fill-height
    .d-flex.px-3.align-items-center(style="height:48px")
        v-btn(text, @click="() => editor.addDefaultTrack()") Add Track
        v-divider.mx-4(vertical)
        v-slider(:value="volume * 100", @input="setVolume", :min="0", :max="100", prepend-icon="volume_up", dense, style="max-width: 10em;", hide-details)
        v-divider.mx-4(vertical)
        v-select(:value="snapUnits", @input="setSnap", :items="snapItems", style="max-width: 12em;", dense, flat, solo, hide-details, prepend-icon="straighten")
        v-divider.mx-4(vertical)
        v-text-field(:value="bpm", @input="setBpm", label="BPM", style="max-width: 6em;", dense, flat, solo, hide-details, prepend-icon="speed")
    #wrapper
        timeline-base
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

import { TICKS_PER_BEAT } from "@/constants";
import { globalState } from "@/globalState";
import TimelineBase from "./components/Timeline.vue";

enum LabelMode {
    BEATS,
    BARS,
}

@Component({
    components: { TimelineBase },
})
export default class Timeline extends Vue {
    public snapItems = [
        { text: "Disabled", value: "1" },
        { text: "1/8 Beat", value: (TICKS_PER_BEAT / 8).toString() },
        { text: "1/6 Beat", value: (TICKS_PER_BEAT / 6).toString() },
        { text: "1/4 Beat", value: (TICKS_PER_BEAT / 4).toString() },
        { text: "1/3 Beat", value: (TICKS_PER_BEAT / 3).toString() },
        { text: "1/2 Beat", value: (TICKS_PER_BEAT / 2).toString() },
        { text: "1 Beat", value: TICKS_PER_BEAT.toString() },
        { text: "2 Beats", value: (2 * TICKS_PER_BEAT).toString() },
        { text: "4 Beats", value: (4 * TICKS_PER_BEAT).toString() },
        { text: "8 Beats", value: (8 * TICKS_PER_BEAT).toString() },
    ];

    private labelMode: LabelMode = LabelMode.BEATS;

    private globalState = globalState;

    public get editor() {
        return this.globalState.timeline;
    }

    public get volume() {
        return this.globalState.volume;
    }

    public get bpm() {
        return globalState.bpm.toString();
    }

    public get snapUnits() {
        return globalState.snapUnits.toString();
    }

    public setVolume(v: number) {
        globalState.volume = Math.max(0, Math.min(1, v / 100));
    }

    public setBpm(v: string) {
        globalState.bpm = parseInt(v, 10);
    }

    public setSnap(value: string) {
        globalState.snapUnits = parseInt(value, 10);
    }
}
</script>

<style scoped>
#wrapper {
    height: calc(100% - 48px);
    overflow: hidden;
}
</style>
