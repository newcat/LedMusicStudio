import { serialize, deserialize } from "bson";
import { Ref, ref } from "vue";
import { defineStore } from "pinia";
import { BaklavaEvent } from "@baklavajs/events";

import { TimelineEditor } from "@/timeline";
import { ipcRenderer } from "@/native";
import { LibraryModel } from "./library/libraryModel";
import { TICKS_PER_BEAT } from "./constants";

const defaults = {
    bpm: 130,
    fps: 30,
    volume: 0.5,
    resolution: 128,
    snapUnits: TICKS_PER_BEAT,
};

export const useGlobalState = defineStore("globalState", () => {
    const eventToken = Symbol();

    const projectFilePath = ref("");
    const bpm = ref(defaults.bpm);
    const fps = ref(defaults.fps);
    const volume = ref(defaults.volume);
    const position = ref(0);
    const isPlaying = ref(false);
    const resolution = ref(defaults.resolution);
    const snapUnits = ref(defaults.snapUnits);

    const library = ref(new LibraryModel()) as Ref<LibraryModel>;
    const timeline = ref(new TimelineEditor(bpm)) as Ref<TimelineEditor>;

    const events = {
        initialized: new BaklavaEvent<void, undefined>(undefined),
        positionSetByUser: new BaklavaEvent<void, undefined>(undefined),
    };

    async function initialize() {
        library.value.events.itemRemoved.subscribe(eventToken, (item) => {
            const itemsToRemove = timeline.value.items.filter((i) => i.libraryItem === item);
            for (const i of itemsToRemove) {
                timeline.value.removeItem(i);
            }
        });
    }

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

        if (library.value) {
            await library.value.destroy();
            library.value.events.itemRemoved.unsubscribe(eventToken);
        }

        library.value = new LibraryModel();
        timeline.value = new TimelineEditor(bpm);

        await initialize();
    }

    function save(): Buffer {
        return serialize({
            timeline: timeline.value.save(),
            library: library.value.save(),
            bpm: bpm.value,
            fps: fps.value,
            volume: volume.value,
            position: position.value,
            resolution: resolution.value,
            snapUnits: snapUnits.value,
        });
    }

    async function load(serialized: Buffer) {
        const data = deserialize(serialized);
        await library.value.load(data.library);
        timeline.value.load(data.timeline, library.value);
        bpm.value = data.bpm ?? defaults.bpm;
        fps.value = data.fps ?? defaults.fps;
        volume.value = data.volume ?? defaults.volume;
        position.value = data.position ?? 0;
        resolution.value = data.resolution ?? defaults.resolution;
        snapUnits.value = data.snapUnits ?? defaults.snapUnits;
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
        library,
        timeline,
        events,
        initialize,
        reset,
        save,
        load,
        setPositionByUser,
    };
});
