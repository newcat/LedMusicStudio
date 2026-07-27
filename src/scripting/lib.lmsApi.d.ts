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
