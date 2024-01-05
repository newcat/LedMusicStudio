import { BaseFixture } from "@/stage/fixtures";
import { VisualizationType } from "./base.visualization";
import { LedStripVisualization } from "./ledStrip/ledStrip.visualization";
import { SpotVisualization } from "./spot/spot.visualization";

export function createFixtureVisualization(type: VisualizationType, fixture: BaseFixture) {
    switch (type) {
        case VisualizationType.LED_STRIP:
            if (!LedStripVisualization.isCompatibleFixture(fixture)) {
                throw new Error(`Fixture ${fixture.name} is not compatible with visualization type ${type}`);
            }
            return new LedStripVisualization(fixture);
        case VisualizationType.SPOT:
            if (!SpotVisualization.isCompatibleFixture(fixture)) {
                throw new Error(`Fixture ${fixture.name} is not compatible with visualization type ${type}`);
            }
            return new SpotVisualization(fixture);
        default:
            throw new Error(`No visualization for type ${type}`);
    }
}
