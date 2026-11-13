import { VisualizationType } from "../../../fixtureVisualization";
import { createEffectVisualization } from "../effectVisualization";

/**
 * Laser projector (feature 003, T062): DMX fixtures, a mapping auto-mapped for LASER and the options
 * `{ kind: "laser", pattern: "fan", beams: 8, spread: 40, color: "#00ff00" }`.
 */
export const LaserVisualization = createEffectVisualization(VisualizationType.LASER);
