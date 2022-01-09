import { serialize, deserialize } from "bson";
import { reactive } from "vue";
import { BaklavaEvent } from "@baklavajs/events";
import { ipcRenderer } from "electron";

import { TimelineEditor } from "@/timeline";
import { LibraryModel } from "./library/libraryModel";
import { TICKS_PER_BEAT } from "./constants";

interface IProp {
    type: string;
    x: number;
    y: number;
    angle: number;
}

interface IScene {
    props: IProp[];
}

export interface IState {
    scene: IScene;
    library: LibraryModel;
    timeline: TimelineEditor;
    bpm: number;
    fps: number;
    snapUnits: number;
}

const defaults = {
    bpm: 130,
    fps: 30,
    volume: 0.5,
    resolution: 128,
    snapUnits: TICKS_PER_BEAT,
};

export class State implements IState {
    public scene: IScene = { props: [] };
    public library!: LibraryModel;
    public timeline!: TimelineEditor;

    public projectFilePath = "";
    public bpm = defaults.bpm;
    public fps = defaults.fps;
    public volume = defaults.volume;
    public position = 0;
    public isPlaying = false;
    public resolution = defaults.resolution;
    public snapUnits = defaults.snapUnits;

    public events = {
        initialized: new BaklavaEvent<void, this>(this),
        positionSetByUser: new BaklavaEvent<void, this>(this),
    };

    constructor() {
        (window as any).globalState = this;
    }

    public async initialize() {
        if (this.library) {
            await this.library.destroy();
            this.library.events.itemRemoved.unsubscribe(this);
        }

        this.library = new LibraryModel();
        this.library.events.itemRemoved.subscribe(this, (item) => {
            const itemsToRemove = this.timeline.items.filter((i) => i.libraryItem === item);
            for (const i of itemsToRemove) {
                this.timeline.removeItem(i);
            }
        });

        this.timeline = new TimelineEditor();
        this.events.initialized.emit();
    }

    public async reset() {
        ipcRenderer.send("RESET");
        this.projectFilePath = "";
        this.bpm = defaults.bpm;
        this.fps = defaults.fps;
        this.volume = defaults.volume;
        this.position = 0;
        this.isPlaying = false;
        this.resolution = defaults.resolution;
        this.snapUnits = defaults.snapUnits;
        await this.initialize();
    }

    public save(): Buffer {
        return serialize({
            scene: this.scene,
            timeline: this.timeline.save(),
            library: this.library.save(),
            bpm: this.bpm,
            fps: this.fps,
            volume: this.volume,
            position: this.position,
            resolution: this.resolution,
            snapUnits: this.snapUnits,
        });
    }

    public async load(serialized: Buffer) {
        const data = deserialize(serialized);
        this.scene = data.scene;
        await this.library.load(data.library);
        this.timeline.load(data.timeline, this.library);
        this.bpm = data.bpm ?? defaults.bpm;
        this.fps = data.fps ?? defaults.fps;
        this.volume = data.volume ?? defaults.volume;
        this.position = data.position ?? 0;
        this.resolution = data.resolution ?? defaults.resolution;
        this.snapUnits = data.snapUnits ?? defaults.snapUnits;
    }

    public setPositionByUser(newPosition: number) {
        this.position = newPosition;
        this.events.positionSetByUser.emit();
    }
}

export const globalState = reactive(new State());
