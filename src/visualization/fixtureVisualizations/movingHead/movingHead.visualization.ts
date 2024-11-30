import { markRaw } from "vue";
import { DmxFixture, FixtureType } from "@/stage/fixtures";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import { MovingHeadVisualizationConfig } from "./movingHead.visualizationConfig";
import MovingHeadVisualizationSettings from "./MovingHeadVisualizationSettings.vue";

export const MovingHeadVisualization: FixtureVisualization<DmxFixture, MovingHeadVisualizationConfig, number[]> = {
    type: VisualizationType.MOVING_HEAD,
    compatibleFixtures: [FixtureType.DMX],
    defaultConfig: () => ({
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        channelMapping: {
            pan: {
                channel: -1,
                defaultValue: 0,
                min: -180,
                max: 180,
            },
            tilt: {
                channel: -1,
                defaultValue: 0,
                min: -120,
                max: 120,
            },
            beamAngle: {
                channel: -1,
                defaultValue: 10,
                min: 1,
                max: 45,
            },
            red: -1,
            green: -1,
            blue: -1,
        },
    }),
    settingsComponent: markRaw(MovingHeadVisualizationSettings),
    onFixtureValueUpdate: (value) => {
        return {
            value: value,
        };
    },
};
