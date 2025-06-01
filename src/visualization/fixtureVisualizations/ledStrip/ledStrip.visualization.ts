import { markRaw } from "vue";

import { FixtureType, LedStripFixture } from "@/stage/fixtures";
import { Color } from "@/graph/colors";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import LedStripVisualizationSettings from "./LedStripVisualizationSettings.vue";
import { LedStripVisualizationConfig } from "./types";

export const LedStripVisualization: FixtureVisualization<LedStripFixture, LedStripVisualizationConfig, Color[]> = {
    type: VisualizationType.LED_STRIP,
    compatibleFixtures: [FixtureType.LED_STRIP],
    defaultConfig: () => ({
        intensity: 0.001,
        start: [0, 0, 0],
        end: [0, 0, 0],
        direction: [1, 0, 0],
    }),
    settingsComponent: markRaw(LedStripVisualizationSettings),
    onFixtureValueUpdate: (value) => {
        return {
            value: value,
        };
    },
};
