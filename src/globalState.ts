import { ref } from "vue";
import { defineStore } from "pinia";
import { IGraphTemplateState } from "baklavajs";
import { BaklavaEvent } from "@baklavajs/events";

import { ITimelineState, useTimeline } from "@/timeline";
import { ILibraryState, useLibrary } from "./library";
import { useGraphTemplateSync } from "./graph";
import { TICKS_PER_BEAT } from "./constants";
import { StageState, useStage } from "./stage";

const defaults = {
    bpm: 130,
    fps: 30,
    volume: 0.5,
    resolution: 128,
    snapUnits: TICKS_PER_BEAT,
};

export interface SavedState {
    stage: StageState;
    timeline: ITimelineState;
    library: ILibraryState;
    bpm: number;
    fps: number;
    volume: number;
    position: number;
    resolution: number;
    snapUnits: number;
    bridgeUrl: string;
    graphTemplates: IGraphTemplateState[];
}

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

    const stage = useStage();
    const library = useLibrary();
    const timeline = useTimeline();
    const graphTemplates = useGraphTemplateSync();

    const events = {
        positionSetByUser: new BaklavaEvent<void, undefined>(undefined),
    };

    async function reset() {
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
        stage.reset();
    }

    function save() {
        const state: SavedState = {
            stage: stage.save(),
            timeline: timeline.save(),
            library: library.save(),
            graphTemplates: graphTemplates.save(),
            bpm: bpm.value,
            fps: fps.value,
            volume: volume.value,
            position: position.value,
            resolution: resolution.value,
            snapUnits: snapUnits.value,
            bridgeUrl: bridgeUrl.value,
        };
        return JSON.stringify(state);
    }

    async function load(raw: string) {
        const data: SavedState = JSON.parse(raw) as SavedState;
        stage.load(data.stage);
        graphTemplates.load(data.graphTemplates ?? []);
        await library.load(data.library);
        timeline.load(data.timeline);
        bpm.value = data.bpm ?? defaults.bpm;
        fps.value = data.fps ?? defaults.fps;
        volume.value = data.volume ?? defaults.volume;
        position.value = data.position ?? 0;
        resolution.value = data.resolution ?? defaults.resolution;
        snapUnits.value = data.snapUnits ?? defaults.snapUnits;
        bridgeUrl.value = data.bridgeUrl ?? "";
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
        graphTemplates,
        timeline,
        events,
        reset,
        save,
        load,
        setPositionByUser,
    };
});
