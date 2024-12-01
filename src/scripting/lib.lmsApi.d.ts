interface LMSDmxFixture {
    type: "dmx";
    setValue(channel: number, value: number): void;
}

interface LMSFixturesApi {
    findFixtureByName(name: string): LMSDmxFixture | null;
}

interface LMSStageApi {
    readonly fixtures: LMSFixturesApi;
}

interface LMSApi {
    readonly stage: LMSStageApi;
}

declare var lmsApi: LMSApi;

declare function thisIsAnExampleFunction(): void;
