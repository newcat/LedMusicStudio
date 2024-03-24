import type { Item } from "@/timeline";

import { watchEffect } from "vue";
import { BaklavaEvent } from "@baklavajs/events";

import { AudioLibraryItem, AudioProcessor, Metronome } from "@/audio";
import { LibraryItemType } from "@/library";
import { BaseTimelineProcessor } from "./baseTimelineProcessor";

export class TimelineProcessor extends BaseTimelineProcessor {
    public events = {
        tick: new BaklavaEvent<void, this>(this),
        globalPreviewUpdated: new BaklavaEvent<void, this>(this),
    };

    private timer?: ReturnType<typeof setInterval>;
    private observers: Array<() => void> = [];

    private audioProcessor: AudioProcessor;
    private metronome: Metronome;

    // this is needed because onIsPlayingChanged is sometimes called multiple times
    // which would lead to stuttery playback otherwise due to many subsequent play() calls
    private internalPlayState = false;

    public constructor() {
        super();
        (window as any).processor = this; // for debugging purposes; can now be accessed in dev tools console
        this.observers.forEach((stopWatching) => stopWatching());
        this.observers = [];
        this.observers.push(watchEffect(() => this.setTimer()));
        this.observers.push(watchEffect(() => this.onIsPlayingChanged()));
        this.audioProcessor = new AudioProcessor();
        this.metronome = new Metronome(this.audioProcessor);
    }

    public onIsPlayingChanged() {
        if (this.globalState.isPlaying && !this.internalPlayState) {
            this.audioProcessor?.play();
            this.internalPlayState = true;
        } else if (!this.globalState.isPlaying && this.internalPlayState) {
            this.audioProcessor?.pause();
            this.internalPlayState = false;
        }
    }

    public override async process(unit: number): Promise<void> {
        await super.process(unit);
        this.stage.afterFrame();
        this.metronome.tick(unit);
    }

    private setTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.timer = setInterval(() => this.tick(), 1000 / this.globalState.fps);
    }

    private tick() {
        if (!this.globalState.isPlaying || !this.audioProcessor) {
            return;
        }
        this.globalState.position = this.audioProcessor.updatePosition();
        this.process(this.globalState.position);
        this.events.tick.emit();
    }

    protected override activate(item: Item) {
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
                if (this.globalState.isPlaying) {
                    prevent();
                }
            });
        }
    }

    protected override deactivate(item: Item) {
        if (item.libraryItem.type === LibraryItemType.AUDIO) {
            const af = item.libraryItem as AudioLibraryItem;
            item.events.moved.unsubscribe(this);
            item.events.beforeMoved.unsubscribe(this);
            this.audioProcessor!.unregisterBuffer(af.audioBuffer!);
        }
    }
}
