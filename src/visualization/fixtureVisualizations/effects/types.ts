/** Config of the effect visualizations: Laser, Flame, CO2 Jet, Cold Spark, Fog / Haze (feature 003). */
import type { CapabilityMapping } from "@/visualization/capabilities/types";
import type { VisualizationType } from "@/visualization/fixtureVisualization";

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

type AnyEffectOptions = EffectVisualizationConfig["options"];
type AnyEffectKind = AnyEffectOptions["kind"];

/** Options of one effect kind, e.g. `EffectOptionsOf<"flame">` = `FlameOptions`. */
export type EffectOptionsOf<K extends AnyEffectKind> = Extract<AnyEffectOptions, { kind: K }>;

/**
 * Effect kind of each effect visualization type. Keyed by the enum's string values so this module needs only a
 * type-only import of `VisualizationType` (as `KEYS_BY_TYPE`).
 */
export const EFFECT_KIND_BY_TYPE = {
    Laser: "laser",
    Flame: "flame",
    "CO2 Jet": "co2",
    "Cold Spark": "spark",
    "Fog / Haze": "fog",
} as const satisfies Partial<Record<VisualizationType, AnyEffectKind>>;

/** Effect kind of `type`, or null for non-effect types. */
export function effectKindOf(type: VisualizationType | string): AnyEffectKind | null {
    return (EFFECT_KIND_BY_TYPE as Record<string, AnyEffectKind | undefined>)[type] ?? null;
}

/** Fresh default options of each effect kind (tasks T062–T066). */
export function defaultEffectOptions<K extends AnyEffectKind>(kind: K): EffectOptionsOf<K> {
    const defaults: { [P in AnyEffectKind]: EffectOptionsOf<P> } = {
        laser: { kind: "laser", pattern: "fan", beams: 8, spread: 40, color: "#00ff00" },
        flame: { kind: "flame", maxHeight: 3 },
        co2: { kind: "co2", maxHeight: 6 },
        spark: { kind: "spark", maxHeight: 3 },
        fog: { kind: "fog", fogType: "haze", hazeContribution: 0.5 },
    };
    return defaults[kind];
}
