import { markRaw } from "vue";
import { DmxFixture, FixtureType } from "@/stage/fixtures";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import { emptyMapping } from "../../capabilities/types";
import GenericVisualizationSettings from "./GenericVisualizationSettings.vue";
import { GenericVisualizationConfig } from "./types";

/** Body plus emitters lit with RGB(W) × dimmer (feature 002, FR-022). */
export const GenericVisualization: FixtureVisualization<DmxFixture, GenericVisualizationConfig, number[]> = {
    type: VisualizationType.GENERIC,
    compatibleFixtures: [FixtureType.DMX],
    // surfaceLight and lightAngle depend on the model and are set by `withModelRanges` (scene/fixtureModels.ts)
    defaultConfig: () => ({
        mapping: emptyMapping(),
        surfaceLight: false,
        lightAngle: 90,
    }),
    settingsComponent: markRaw(GenericVisualizationSettings),
    onFixtureValueUpdate: (value) => ({ value }),
};
