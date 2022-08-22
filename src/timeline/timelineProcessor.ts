import type { Item } from "@/timeline";
import type { BaseOutput, OutputLibraryItem } from "@/output";

import { watchEffect } from "vue";
import { BaklavaEvent } from "@baklavajs/events";
import { applyResult } from "@baklavajs/engine";

import { AudioLibraryItem, AudioProcessor } from "@/audio";
import { GraphLibraryItem } from "@/graph";
import { AutomationLibraryItem } from "@/automation";
import { LibraryItemType } from "@/library";
import { INote, PatternLibraryItem } from "@/pattern";
import { ICalculationData } from "@/graph";
import { globalState } from "@/globalState";

export class TimelineProcessor {
    public trackValues = new Map<string, number | INote[]>(); // maps trackId -> value

    public events = {
        tick: new BaklavaEvent<void, this>(this),
        globalPreviewUpdated: new BaklavaEvent<void, this>(this),
    };

    private timer?: ReturnType<typeof setInterval>;
    private observers: Array<() => void> = [];

    private activeItems: Item[] = [];
    private audioProcessor?: AudioProcessor;

    // this is needed because onIsPlayingChanged is sometimes called multiple times
    // which would lead to stuttery playback otherwise due to many subsequent play() calls
    private internalPlayState = false;

    public constructor() {
        (window as any).processor = this; // for debugging purposes; can now be accessed in dev tools console
        globalState.events.initialized.subscribe(this, () => this.initialize());
    }

    public initialize() {
        console.log("Timeline initializing");
        if (this.audioProcessor) {
            this.audioProcessor.destroy();
        }
        this.observers.forEach((stopWatching) => stopWatching());
        this.observers = [];
        this.observers.push(watchEffect(() => this.setTimer()));
        this.observers.push(watchEffect(() => this.onIsPlayingChanged()));
        this.audioProcessor = new AudioProcessor(globalState);
        console.log("Timeline initialized");
    }

    public onIsPlayingChanged() {
        if (globalState.isPlaying && !this.internalPlayState) {
            this.audioProcessor?.play();
            this.internalPlayState = true;
        } else if (!globalState.isPlaying && this.internalPlayState) {
            this.audioProcessor?.pause();
            this.internalPlayState = false;
        }
    }

    private setTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.timer = setInterval(() => this.tick(), 1000 / globalState.fps);
    }

    private tick() {
        if (!globalState.isPlaying || !this.audioProcessor) {
            return;
        }
        globalState.position = this.audioProcessor.updatePosition();
        this.process(globalState.position);
        this.events.tick.emit();
    }

    public async process(unit: number) {
        const currentActiveItems = globalState.timeline.items.filter((i) => i.start <= unit && i.end >= unit);

        const newActiveItems = currentActiveItems.filter((i) => !this.activeItems.includes(i));
        newActiveItems.forEach((i) => this.activate(i));

        const newInactiveItems = this.activeItems.filter((i) => !currentActiveItems.includes(i));
        newInactiveItems.forEach((i) => this.deactivate(i));

        this.activeItems = currentActiveItems;

        currentActiveItems.filter((i) => this.isType(i, LibraryItemType.AUTOMATION)).forEach((i) => this.processAutomation(unit, i));
        currentActiveItems.filter((i) => this.isType(i, LibraryItemType.PATTERN)).forEach((i) => this.processPattern(unit, i));

        const audioData = this.audioProcessor!.getAudioData();

        const calculationData: ICalculationData = {
            resolution: globalState.resolution,
            fps: globalState.fps,
            position: unit,
            sampleRate: audioData.sampleRate,
            timeDomainData: audioData.timeDomainData,
            frequencyData: audioData.frequencyData,
            trackValues: this.trackValues,
        };
        const outputMap: Map<BaseOutput, any> = new Map();
        const graphs = currentActiveItems.filter((i) => this.isType(i, LibraryItemType.GRAPH));
        for (const g of graphs) {
            try {
                await this.processGraph(g, calculationData, outputMap);
                if (g.libraryItem.error) {
                    g.libraryItem.error = false;
                }
            } catch (err) {
                console.error(err);
                g.libraryItem.error = true;
            }
        }

        const outputs = globalState.library.items.filter((i) => i.type === LibraryItemType.OUTPUT) as OutputLibraryItem[];
        for (const o of outputs) {
            await o.outputInstance.onData(outputMap.get(o.outputInstance));
        }
        for (const o of outputs) {
            await o.outputInstance.send();
        }
    }

    private activate(item: Item) {
        if (item.libraryItem.type === LibraryItemType.AUDIO) {
            const af = item.libraryItem as AudioLibraryItem;
            if (af.loading) {
                af.events.loaded.subscribe(this, () => {
                    af.events.loaded.unsubscribe(this);
                    this.activate(item);
                });
            }
            this.audioProcessor!.registerBuffer(af.audioBuffer!, item.start);
            item.events.moved.subscribe(this, () => {
                this.audioProcessor!.unregisterBuffer(af.audioBuffer!);
                this.audioProcessor!.registerBuffer(af.audioBuffer!, item.start);
            });
            item.events.beforeMoved.subscribe(this, (item, prevent) => {
                // TODO: moving an audio item while playing causes continuos stuttering during playback for whatever reason.
                // As a workaround, prevent items from being moved while playing
                if (globalState.isPlaying) {
                    prevent();
                }
            });
        }
    }

    private deactivate(item: Item) {
        if (item.libraryItem.type === LibraryItemType.AUDIO) {
            const af = item.libraryItem as AudioLibraryItem;
            item.events.moved.unsubscribe(this);
            item.events.beforeMoved.unsubscribe(this);
            this.audioProcessor!.unregisterBuffer(af.audioBuffer!);
        } else if (item.libraryItem.type === LibraryItemType.PATTERN) {
            this.trackValues.set(item.trackId, []);
        }
    }

    private isType(item: Item, type: LibraryItemType): boolean {
        return item.libraryItem.type === type;
    }

    private async processGraph(item: Item, calculationData: ICalculationData, outputMap: Map<BaseOutput, any>): Promise<void> {
        const graph = item.libraryItem as GraphLibraryItem;
        const results = (await graph.editor.enginePlugin.runOnce(calculationData))!;
        graph.editor.enginePlugin.pause();
        applyResult(results, graph.editor.editor);
        graph.editor.enginePlugin.resume();
        results.forEach((intfValues) => {
            if (!intfValues.has("outputId")) {
                return;
            }
            const output = globalState.library.getItemById<OutputLibraryItem>(intfValues.get("outputId"))?.outputInstance;
            if (output) {
                const data = intfValues.get("data");
                outputMap.set(output, data);
            }
        });
    }

    private processAutomation(unit: number, item: Item): void {
        const ac = item.libraryItem as AutomationLibraryItem;
        const value = ac.getValueAt(unit - item.start);
        this.trackValues.set(item.trackId, value);
    }

    private processPattern(unit: number, item: Item): void {
        const np = item.libraryItem as PatternLibraryItem;
        const notes = np.getNotesAt(unit - item.start);
        this.trackValues.set(item.trackId, notes);
    }
}
