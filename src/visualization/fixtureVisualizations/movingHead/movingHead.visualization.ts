import { markRaw } from "vue";
import { DmxFixture, FixtureType } from "@/stage/fixtures";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import { emptyMapping } from "../../capabilities/types";
import { defaultMovement, type BeamVisualizationConfig } from "../beam/types";
import { defaultBeamAngleFor } from "../modelDefaults";
import BeamVisualizationSettings from "../beam/BeamVisualizationSettings.vue";

export const MovingHeadVisualization: FixtureVisualization<DmxFixture, BeamVisualizationConfig, number[]> = {
    type: VisualizationType.MOVING_HEAD,
    compatibleFixtures: [FixtureType.DMX],
    // softness and the pan/tilt ranges depend on the model and are set by `withModelRanges` (scene/fixtureModels.ts)
    defaultConfig: (fixture) => ({
        mapping: emptyMapping(),
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
