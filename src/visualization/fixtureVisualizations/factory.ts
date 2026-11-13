import { BaseFixture } from "@/stage/fixtures";
import { VisualizationType } from "../fixtureVisualization";
import { FixtureVisualizationController } from "../fixtureVisualizationController";
import { LedStripVisualization } from "./ledStrip/ledStrip.visualization";
import { SpotVisualization } from "./spot/spot.visualization";
import { MovingHeadVisualization } from "./movingHead/movingHead.visualization";
import { GenericVisualization } from "./generic/generic.visualization";
import { LaserVisualization } from "./effects/laser/laser.visualization";
import { FlameVisualization } from "./effects/flame/flame.visualization";
import { Co2Visualization } from "./effects/co2/co2.visualization";
import { SparkVisualization } from "./effects/spark/spark.visualization";
import { FogVisualization } from "./effects/fog/fog.visualization";

export function createFixtureVisualizationController(
    type: VisualizationType,
    fixture: BaseFixture
    // The concrete types depend on the runtime `type`, which TypeScript can't correlate here.
): FixtureVisualizationController<any, any, any> {
    const visualization = getVisualizationByType(type);
    if (!visualization.compatibleFixtures.includes(fixture.type)) {
        throw new Error(`Fixture ${fixture.name} is not compatible with visualization type ${type}`);
    }
    // `fixture` was checked against `compatibleFixtures` above; the cast bridges the union of visualization types.
    return new FixtureVisualizationController(visualization, fixture as any);
}

export function getVisualizationByType(type: VisualizationType) {
    switch (type) {
        case VisualizationType.LED_STRIP:
            return LedStripVisualization;
        case VisualizationType.SPOT:
            return SpotVisualization;
        case VisualizationType.MOVING_HEAD:
            return MovingHeadVisualization;
        case VisualizationType.GENERIC:
            return GenericVisualization;
        case VisualizationType.LASER:
            return LaserVisualization;
        case VisualizationType.FLAME:
            return FlameVisualization;
        case VisualizationType.CO2_JET:
            return Co2Visualization;
        case VisualizationType.COLD_SPARK:
            return SparkVisualization;
        case VisualizationType.FOG:
            return FogVisualization;
        default:
            throw new Error(`No visualization for type ${type}`);
    }
}
