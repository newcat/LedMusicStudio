import { markRaw } from "vue";

import { DmxFixture, FixtureType } from "@/stage/fixtures";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import { defaultMappingFor } from "../defaultMapping";
import { defaultMovement, type BeamVisualizationConfig } from "../beam/types";
import { defaultBeamAngleFor } from "../modelDefaults";
import BeamVisualizationSettings from "../beam/BeamVisualizationSettings.vue";

export const SpotVisualization: FixtureVisualization<DmxFixture, BeamVisualizationConfig, number[]> = {
    type: VisualizationType.SPOT,
    compatibleFixtures: [FixtureType.DMX],
    // softness depends on the model and is set by `withModelRanges` (scene/fixtureModels.ts)
    defaultConfig: (fixture, modelId) => ({
        mapping: defaultMappingFor(fixture, VisualizationType.SPOT, modelId),
        movement: defaultMovement(),
        defaultBeamAngle: defaultBeamAngleFor(fixture?.config.definition, fixture?.config.mode),
        softness: 0.25,
        prismSpread: 6,
    }),
    settingsComponent: markRaw(BeamVisualizationSettings),
    onFixtureValueUpdate: (value) => {
        return {
            value: value,
        };
    },
};
