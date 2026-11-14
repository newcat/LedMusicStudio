import { markRaw } from "vue";

import { Color } from "@/graph/colors";
import { scaleColorArray } from "@/utils";
import { BaseFixture, FixtureType } from "../base.fixture";
import LedStripFixtureSettings from "./LedStripFixtureSettings.vue";

/** LED count of a new strip fixture (60 LEDs = 1 m of a common 60 LED/m strip). */
export const DEFAULT_NUM_LEDS = 60;

interface LedStripFixtureConfiguration {
    numLeds: number;
}

export class LedStripFixture extends BaseFixture<Color[], LedStripFixtureConfiguration> {
    public override readonly type = FixtureType.LED_STRIP;
    public override readonly settingsComponent = markRaw(LedStripFixtureSettings);

    public get validationErrors(): string[] {
        return [];
    }

    constructor() {
        // a single LED would only show the first pixel of a graph's output (usually black)
        super([[0, 0, 0]], { numLeds: DEFAULT_NUM_LEDS });
        this.name = "LED Strip";
    }

    public override setValue(v: Color[]) {
        if (v.length !== this.config.numLeds) {
            v = scaleColorArray(v, this.config.numLeds);
        }
        super.setValue(v);
    }

    public override resetValue(): void {
        this.setValue([[0, 0, 0]]);
    }
}
