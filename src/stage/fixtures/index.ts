export enum StageFixtureType {
    WLED,
}

export interface BaseStageFixture {
    type: StageFixtureType;
    id: string;
    name: string;
    outputId: string;
}

export interface WledStageFixture extends BaseStageFixture {
    type: StageFixtureType.WLED;
    meshId: string;
}

export type StageFixture = WledStageFixture;
