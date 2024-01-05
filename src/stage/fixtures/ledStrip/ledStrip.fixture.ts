import { markRaw } from "vue";

import { Color } from "@/graph/colors";
import { scaleColorArray } from "@/utils";
import { BaseFixture, FixtureType } from "../base.fixture";
import LedStripFixtureSettings from "./LedStripFixtureSettings.vue";

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
        super([[0, 0, 0]], { numLeds: 1 });
        this.name = "LED Strip";
    }

    public override setValue(v: Color[]) {
        if (v.length !== this.config.numLeds) {
            v = scaleColorArray(v, this.config.numLeds);
        }
        super.setValue(v);
    }
}
