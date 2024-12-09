declare interface LMSDmxFixture {
    type: "dmx";
    setValue(channel: number, value: number): void;
}

declare interface LMSFixturesApi {
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

declare interface LMSNote {
    id: string;
    value: number;
    start: number;
    end: number;
    selected: boolean;
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
