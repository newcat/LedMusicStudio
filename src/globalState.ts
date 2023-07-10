import { serialize, deserialize } from "bson";
import { ref } from "vue";
import { defineStore } from "pinia";
import { BaklavaEvent } from "@baklavajs/events";

import { useTimeline } from "@/timeline";
import { ipcRenderer } from "@/native";
import { useLibrary } from "./library";
import { TICKS_PER_BEAT } from "./constants";

const defaults = {
    bpm: 130,
    fps: 30,
    volume: 0.5,
    resolution: 128,
    snapUnits: TICKS_PER_BEAT,
};

export const useGlobalState = defineStore("globalState", () => {
    const projectFilePath = ref("");
    const bpm = ref(defaults.bpm);
    const fps = ref(defaults.fps);
    const volume = ref(defaults.volume);
    const position = ref(0);
    const isPlaying = ref(false);
    const resolution = ref(defaults.resolution);
    const snapUnits = ref(defaults.snapUnits);
    const metronome = ref(false);
    const bridgeUrl = ref("");

    const library = useLibrary();
    const timeline = useTimeline();

    const events = {
        positionSetByUser: new BaklavaEvent<void, undefined>(undefined),
    };

    async function reset() {
        ipcRenderer.send("RESET");

        projectFilePath.value = "";
        bpm.value = defaults.bpm;
        fps.value = defaults.fps;
        volume.value = defaults.volume;
        position.value = 0;
        isPlaying.value = false;
        resolution.value = defaults.resolution;
        snapUnits.value = defaults.snapUnits;
        bridgeUrl.value = "";

        await library.reset();
        timeline.reset();
    }

    function save() {
        return serialize({
            timeline: timeline.save(),
            library: library.save(),
            bpm: bpm.value,
            fps: fps.value,
            volume: volume.value,
            position: position.value,
            resolution: resolution.value,
            snapUnits: snapUnits.value,
            bridgeUrl: bridgeUrl.value,
        });
    }

    async function load(serialized: Buffer) {
        const data = deserialize(serialized);
        await library.load(data.library);
        timeline.load(data.timeline);
        bpm.value = data.bpm ?? defaults.bpm;
        fps.value = data.fps ?? defaults.fps;
        volume.value = data.volume ?? defaults.volume;
        position.value = data.position ?? 0;
        resolution.value = data.resolution ?? defaults.resolution;
        snapUnits.value = data.snapUnits ?? defaults.snapUnits;
        bridgeUrl.value = bridgeUrl.value ?? "";
    }

    function setPositionByUser(newPosition: number) {
        position.value = newPosition;
        events.positionSetByUser.emit();
    }

    return {
        projectFilePath,
        bpm,
        fps,
        volume,
        position,
        isPlaying,
        resolution,
        snapUnits,
        metronome,
        bridgeUrl,
        timeline,
        events,
        reset,
        save,
        load,
        setPositionByUser,
    };
});
