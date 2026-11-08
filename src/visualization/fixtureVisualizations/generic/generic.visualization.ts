import { markRaw } from "vue";
import { DmxFixture, FixtureType } from "@/stage/fixtures";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import GenericVisualizationSettings from "./GenericVisualizationSettings.vue";
import { GenericVisualizationConfig } from "./types";

/** Body plus emitters lit with RGB(W) × intensity (feature 002, FR-022). */
export const GenericVisualization: FixtureVisualization<DmxFixture, GenericVisualizationConfig, number[]> = {
    type: VisualizationType.GENERIC,
    compatibleFixtures: [FixtureType.DMX],
    defaultConfig: () => ({
        channelMapping: {
            intensity: { channel: -1, defaultValue: 1, min: 0, max: 1 },
            red: -1,
            green: -1,
            blue: -1,
            white: -1,
        },
    }),
    settingsComponent: markRaw(GenericVisualizationSettings),
    onFixtureValueUpdate: (value) => ({ value }),
};
