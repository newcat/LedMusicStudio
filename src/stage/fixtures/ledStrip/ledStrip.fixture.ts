import { markRaw } from "vue";
import * as THREE from "three";
import { OutputType } from "@/output";
import { BaseStageFixture, StageFixtureType } from "../base.fixture";
import LedStripFixtureSettings from "./LedStripFixtureSettings.vue";
import { ThreeLedStripFixture } from "./ledStrip.three";

export class LedStripStageFixture extends BaseStageFixture {
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
}
