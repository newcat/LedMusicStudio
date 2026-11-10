/** Config of the Spot and Moving Head visualizations (feature 003, contracts/scene-state-delta.ts). */
import type { CapabilityMapping } from "@/visualization/capabilities/types";

export interface MovementSettings {
    /** default "realistic" (FR-002) */
    mode: "realistic" | "instant";
    /** degrees per second, 30..1500, defaults 600 / 400 (research R6) */
    panSpeed: number;
    tiltSpeed: number;
}

/** SPOT and MOVING_HEAD (replaces SpotVisualizationConfig and MovingHeadVisualizationConfig). */
export interface BeamVisualizationConfig {
    mapping: CapabilityMapping;
    movement: MovementSettings;
    /** Beam angle in degrees when zoom is unmapped; default from the OFL lens data or 15. */
    defaultBeamAngle: number;
    /** Edge softness 0..1 (hard profile ↔ soft wash); default from the model type (profile 0.1, par 0.4, wash 0.7). */
    softness: number;
    /** Degrees between prism facet beams, default 6. */
    prismSpread: number;
}

export function defaultMovement(): MovementSettings {
    return { mode: "realistic", panSpeed: 600, tiltSpeed: 400 };
}
