import { markRaw } from "vue";

import { DmxFixture, FixtureType } from "@/stage/fixtures";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import SpotVisualizationSettings from "./SpotVisualizationSettings.vue";
import { SpotVisualizationConfig } from "./types";

export const SpotVisualization: FixtureVisualization<DmxFixture, SpotVisualizationConfig, number[]> = {
    type: VisualizationType.SPOT,
    compatibleFixtures: [FixtureType.DMX],
    defaultConfig: () => ({
        colorChannels: [-1, -1, -1, -1],
    }),
    settingsComponent: markRaw(SpotVisualizationSettings),
    onFixtureValueUpdate: (value) => {
        return {
            value: value,
        };
    },
};
