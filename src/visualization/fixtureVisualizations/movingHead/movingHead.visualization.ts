import { DmxFixture, FixtureType } from "@/stage/fixtures";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import { MovingHeadVisualizationConfig } from "./types";

export const MovingHeadVisualization: FixtureVisualization<DmxFixture, MovingHeadVisualizationConfig, number[]> = {
    type: VisualizationType.MOVING_HEAD,
    compatibleFixtures: [FixtureType.DMX],
    defaultConfig: () => ({
        position: [0, 0, 0],
        target: [0, 0, 0],
        colorChannels: [-1, -1, -1, -1],
    }),
    onFixtureValueUpdate: (value) => {
        return {
            value: value,
        };
    },
};
