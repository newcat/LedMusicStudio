/** Config of the Generic Fixture visualization (feature 003, contracts/scene-state-delta.ts). */
import type { CapabilityMapping } from "@/visualization/capabilities/types";

/** GENERIC: emitters, pixel/multi-cell fixtures, strobes, blinders. */
export interface GenericVisualizationConfig {
    mapping: CapabilityMapping;
    /** Contribute a wide light to surfaces (strobes, blinders, bars); default true for those models. */
    surfaceLight: boolean;
    /** Light cone angle in degrees for the surface light, default 90 (blinders) / 120 (strobes). */
    lightAngle: number;
}
