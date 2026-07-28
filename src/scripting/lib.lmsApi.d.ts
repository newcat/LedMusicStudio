/**
 * Ambient declarations for the scripting API.
 *
 * These are loaded into the script editor's TypeScript environment as a root file. They are also part of the app's own
 * `tsconfig.json` (`src/**​/*.d.ts`), which is what keeps them honest: every runtime object exposed to scripts declares
 * `implements` against the interface below, so `vue-tsc` fails the build if the implementation and the declaration drift apart.
 *
 * The per-project `stage` and `tracks` declarations are generated separately — see `generateStageDeclarations.ts`.
 */

/** RGB, each component 0..255. */
declare type LMSColor = [number, number, number];

declare interface LMSLedStrip<TLength extends number = number> {
    readonly type: "ledStrip";
    readonly id: string;
    readonly name: string;
    /** Number of LEDs, known at compile time for generated fixtures. */
    readonly length: TLength;
    get(index: number): LMSColor;
    set(index: number, color: LMSColor): void;
    /** Set every LED to the same colour. */
    fill(color: LMSColor): void;
    /** Set every LED from an array; shorter or longer arrays are scaled to fit. */
    setAll(colors: readonly LMSColor[]): void;
    /**
     * Set how strongly this script's output covers the strip, 0..1.
     *
     * Pixels a script never writes are transparent, so it composites over whatever is below it. This dials back the coverage of
     * the pixels it *has* written — which is what a fade out of a layer looks like.
     */
    setOpacity(alpha: number): void;
}

declare interface LMSDmxFixture<TChannel extends string = string> {
    readonly type: "dmx";
    readonly id: string;
    readonly name: string;
    /** Channel names of the selected mode, in order. */
    readonly channels: readonly TChannel[];
    get(channel: TChannel): number;
    set(channel: TChannel, value: number): void;
    /** Set several channels at once. */
    setChannels(values: Partial<Record<TChannel, number>>): void;
    /**
     * @deprecated Addresses a channel by its index in the mode. Prefer `set(channel, value)`, which checks the channel name
     * against the fixture definition instead of relying on you counting channels correctly.
     */
    setValue(channel: number, value: number): void;
}

declare type LMSFixture = LMSLedStrip | LMSDmxFixture;

declare interface LMSNote {
    id: string;
    value: number;
    start: number;
    end: number;
    selected: boolean;
}

/** A timeline track holding automation clips. */
declare interface LMSAutomationTrack {
    readonly id: string;
    readonly name: string;
    /** Value at the current position, or `undefined` if no clip is active. */
    readonly value: number | undefined;
}

/** A timeline track holding note patterns. */
declare interface LMSPatternTrack {
    readonly id: string;
    readonly name: string;
    /** Notes sounding at the current position; empty if no pattern is active. */
    readonly notes: readonly LMSNote[];
}

/** A timeline track holding a mix of clip types, or none yet. */
declare interface LMSTrack {
    readonly id: string;
    readonly name: string;
    readonly value: number | readonly LMSNote[] | undefined;
}

declare interface LMSFixturesApi {
    /**
     * @deprecated Use the generated `stage` object instead — `stage["My Fixture"]` is checked against the fixtures that
     * actually exist, so a renamed or deleted fixture is an error while you are editing rather than at playback.
     */
    findFixtureByName(name: string): LMSDmxFixture | null;
}

declare interface LMSStageApi {
    readonly fixtures: LMSFixturesApi;
}

declare interface LMSApi {
    readonly stage: LMSStageApi;
}

declare interface LMSScript {
    activate?(): Promise<void> | void;
    deactivate?(): Promise<void> | void;
    tick?(data: LMSCalculationData): Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

/**
 * A unit of sequenced work.
 *
 * A bare `yield` means "this tick is done"; `yield*` runs another flow to completion before carrying on. That is the whole
 * protocol — everything else is built from it.
 */
declare type LMSFlow = Generator<unknown, unknown, unknown>;

declare type LMSEasing = (t: number) => number;

/** Everything a sequence gets on top of the fixtures it declared in `uses`. */
declare interface LMSSequenceApi {
    /** Ticks since the start of this timeline item. */
    readonly tick: number;
    /** Beats since the start of this timeline item. */
    readonly beats: number;
    /** How far through the timeline item we are, 0..1. */
    readonly progress: number;
    readonly data: LMSCalculationData;
    /** Seeded, and reset whenever the sequence restarts, so a given tick always produces the same value. */
    random(): number;
    randomInt(minInclusive: number, maxExclusive: number): number;
    noise(x: number, y?: number): number;
    /** Convert seconds to ticks at the project's tempo. */
    seconds(value: number): number;
    /** Detach a flow to keep running in the background while the sequence carries on. */
    spawn(flow: LMSFlow): void;
}

declare type LMSSequenceContext<TUses> = TUses & LMSSequenceApi;

declare interface LMSSequenceDefinition<TUses extends Record<string, unknown>> {
    /**
     * The fixtures and tracks this sequence drives.
     *
     * Declaring them is what lets the app know which fixtures a sequence controls without running it — used to composite its
     * output as a layer, to report conflicts with other sources, and to tell you at load time when something it needs is gone.
     */
    uses?: TUses;
    run(context: LMSSequenceContext<TUses>): LMSFlow;
}

declare interface LMSSequence {
    readonly __lmsSequence: true;
}

declare function defineSequence<TUses extends Record<string, unknown>>(definition: LMSSequenceDefinition<TUses>): LMSSequence;

/** Do nothing for `ticks` ticks. */
declare function wait(ticks: number): LMSFlow;
/** Run every flow in parallel until all of them finish. */
declare function all(...flows: LMSFlow[]): LMSFlow;
/** Run every flow in parallel until the first one finishes. */
declare function race(...flows: LMSFlow[]): LMSFlow;
/** Run `body` once per index, one after another. */
declare function repeat(count: number, body: (index: number) => LMSFlow): LMSFlow;
/** Run `body` over and over until the timeline item ends. */
declare function forever(body: (iteration: number) => LMSFlow): LMSFlow;
/** Call `apply` once per tick with eased progress, ending exactly on 1. */
declare function tween(ticks: number, apply: (progress: number) => void, ease?: LMSEasing): LMSFlow;
/** Beats expressed in ticks. */
declare function beats(count: number): number;
/** Bars expressed in ticks. */
declare function bars(count: number, beatsPerBar?: number): number;
declare function lerp(from: number, to: number, t: number): number;

declare const easing: {
    linear: LMSEasing;
    easeIn: LMSEasing;
    easeOut: LMSEasing;
    easeInOut: LMSEasing;
    easeInCubic: LMSEasing;
    easeOutCubic: LMSEasing;
};

/** Build a colour from hue, saturation and value, each 0..1. */
declare function hsv(hue: number, saturation: number, value: number): LMSColor;
/** Blend two colours; `factor` 0 returns `a`, 1 returns `b`. */
declare function mix(a: LMSColor, b: LMSColor, factor: number): LMSColor;

declare interface LMSCalculationData {
    resolution: number;
    fps: number;
    position: number;
    sampleRate: number;
    timeDomainData: Float32Array;
    frequencyData: Float32Array;
    trackValues: Map<string, number | LMSNote[]>;
    relativeTrackItemProgress: number;
}

declare const lmsApi: LMSApi;
