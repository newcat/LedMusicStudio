import { markRaw } from "vue";

import { FixtureType, LedStripFixture } from "@/stage/fixtures";
import { Color } from "@/graph/colors";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import LedStripVisualizationSettings from "./LedStripVisualizationSettings.vue";
import { defaultStripPath, LedStripVisualizationConfig } from "./types";

export const LedStripVisualization: FixtureVisualization<LedStripFixture, LedStripVisualizationConfig, Color[]> = {
    type: VisualizationType.LED_STRIP,
    compatibleFixtures: [FixtureType.LED_STRIP],
    defaultConfig: () => ({
        intensity: 1,
        path: defaultStripPath(),
        pixelSize: 0.6,
    }),
    settingsComponent: markRaw(LedStripVisualizationSettings),
    onFixtureValueUpdate: (value) => {
        return {
            value: value,
        };
    },
};
