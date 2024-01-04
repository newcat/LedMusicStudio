import { markRaw } from "vue";
import * as THREE from "three";
import { OutputType } from "@/output";
import { BaseStageFixture, StageFixtureType } from "../base.fixture";
import LedStripFixtureSettings from "./LedStripFixtureSettings.vue";
import { ThreeLedStripFixture } from "../../../stage/visualization/ledStrip.visualization";

interface LedStripStageFixtureState {
    meshId: string;
    numLeds: number;
}

export class LedStripStageFixture extends BaseStageFixture<LedStripStageFixtureState> {
    public readonly settingsComponent = markRaw(LedStripFixtureSettings);
    public readonly compatibleOutputTypes = [OutputType.WLED];

    public meshId: string = "";
    public numLeds: number = 60;

    public get isValid() {
        return !!this.outputId && !!this.meshId;
    }

    constructor() {
        super(StageFixtureType.LED_STRIP, "LED Strip");
    }

    public createThreeInstance(scene: THREE.Scene) {
        return new ThreeLedStripFixture(this, scene);
    }

    public saveState(): LedStripStageFixtureState {
        return {
            meshId: this.meshId,
            numLeds: this.numLeds,
        };
    }
    public loadState(state: LedStripStageFixtureState): void {
        this.meshId = state.meshId;
        this.numLeds = state.numLeds;
    }
}
