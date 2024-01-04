import { markRaw } from "vue";
import * as THREE from "three";

import { OutputType } from "@/output";
import { BaseStageFixture, StageFixtureType } from "../base.fixture";
import { ThreeSpotFixture } from "./spot.three";
import SpotFixtureSettings from "./SpotFixtureSettings.vue";

interface SpotStageFixtureState {
    position: [number, number, number];
    target: [number, number, number];
    colorChannels: [number, number, number];
}

export class SpotStageFixture extends BaseStageFixture<SpotStageFixtureState> {
    public readonly settingsComponent = markRaw(SpotFixtureSettings);
    public readonly compatibleOutputTypes = [OutputType.DMX];

    public position: [number, number, number] = [0, 0, 0];
    public target: [number, number, number] = [0, 0, 0];
    public colorChannels: [number, number, number] = [0, 0, 0];

    public get isValid() {
        return this.colorChannels.every((channel) => channel >= 1 && channel <= 512);
    }

    constructor() {
        super(StageFixtureType.SPOT, "Spot");
    }

    public createThreeInstance(scene: THREE.Scene) {
        return new ThreeSpotFixture(this, scene);
    }

    public saveState(): SpotStageFixtureState {
        return {
            position: this.position,
            target: this.target,
            colorChannels: this.colorChannels,
        };
    }

    public loadState(state: SpotStageFixtureState): void {
        this.position = state.position;
        this.target = state.target;
        this.colorChannels = state.colorChannels;
    }
}
