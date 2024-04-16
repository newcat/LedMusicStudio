import { BaseFixture } from "@/stage/fixtures";
import { VisualizationType } from "../fixtureVisualization";
import { FixtureVisualizationController } from "../fixtureVisualizationController";
import { LedStripVisualization } from "./ledStrip/ledStrip.visualization";
import { SpotVisualization } from "./spot/spot.visualization";

export function createFixtureVisualizationController(
    type: VisualizationType,
    fixture: BaseFixture
): FixtureVisualizationController<any, any, any> {
    const visualization = getVisualizationByType(type);
    if (!visualization.compatibleFixtures.includes(fixture.type)) {
        throw new Error(`Fixture ${fixture.name} is not compatible with visualization type ${type}`);
    }
    return new FixtureVisualizationController(visualization, fixture as any);
}

function getVisualizationByType(type: VisualizationType) {
    switch (type) {
        case VisualizationType.LED_STRIP:
            return LedStripVisualization;
        case VisualizationType.SPOT:
            return SpotVisualization;
        default:
            throw new Error(`No visualization for type ${type}`);
    }
}
