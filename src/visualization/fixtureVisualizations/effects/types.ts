/** Config of the effect visualizations: Laser, Flame, CO2 Jet, Cold Spark, Fog / Haze (feature 003). */
import type { CapabilityMapping } from "@/visualization/capabilities/types";

/** LASER, FLAME, CO2_JET, COLD_SPARK, FOG */
export interface EffectVisualizationConfig {
    mapping: CapabilityMapping;
    /** Effect-specific defaults used when the key is unmapped. */
    options: LaserOptions | FlameOptions | JetOptions | SparkOptions | FogOptions;
}

export interface LaserOptions {
    kind: "laser";
    /** Pattern while `laserPattern` is unmapped. */
    pattern: "beam" | "fan" | "cone" | "sheet" | "dots";
    /** 1..64 */
    beams: number;
    /** Degrees, fan/cone opening. */
    spread: number;
    /** "#rrggbb" when no color is mapped. */
    color: string;
}

export interface FlameOptions {
    kind: "flame";
    /** Meters, default 3. */
    maxHeight: number;
}

export interface JetOptions {
    kind: "co2";
    /** Meters, default 6. */
    maxHeight: number;
}

export interface SparkOptions {
    kind: "spark";
    /** Meters, default 3. */
    maxHeight: number;
}

export interface FogOptions {
    kind: "fog";
    fogType: "fog" | "haze";
    /** Contribution of full output to the effective haze when coupling is on (research R13), 0..1, default 0.5. */
    hazeContribution: number;
}
