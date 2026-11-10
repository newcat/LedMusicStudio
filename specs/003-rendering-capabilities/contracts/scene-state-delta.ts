/**
 * Scene state changes of feature 003 (on top of specs/001-scene-editor/contracts/scene-state.ts and
 * specs/002-asset-library/contracts/scene-state-delta.ts). Implemented in src/scene/model/types.ts and the
 * per-type config files in src/visualization/fixtureVisualizations/<type>/types.ts.
 *
 * All changes are additive or converted on load by sanitize (data-model.md → Load rules); `formatVersion` stays 1.
 */
import type { CapabilityMapping } from "./capability-mapping";

type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------------------------------------------
// Environment (FR-020, FR-060) — new field of SceneStateBase
// ---------------------------------------------------------------------------------------------------------------

export type AmbientPreset = "dark" | "house" | "daylight";

export interface AmbientSetting {
    preset: AmbientPreset;
    /** 0..2, 1 = preset default. */
    brightness: number;
}

export interface SceneEnvironment {
    /** 0..1 (UI: 0–100 %), default 0.3. */
    haze: number;
    /** Active fog/hazer fixtures raise the effective haze (US5.5), default false. */
    hazerCoupling: boolean;
    ambient: {
        /** default { preset: "house", brightness: 1 } */
        editor: AmbientSetting;
        /** default { preset: "dark", brightness: 1 } */
        show: AmbientSetting;
    };
}

export interface SceneStateBaseDelta {
    environment: SceneEnvironment;
}

// ---------------------------------------------------------------------------------------------------------------
// Visualization types
// ---------------------------------------------------------------------------------------------------------------

/** Values of the existing enum stay; five are added (research R14). */
export enum VisualizationType {
    LED_STRIP = "Led Strip",
    SPOT = "Spot",
    MOVING_HEAD = "Moving Head",
    GENERIC = "Generic Fixture",
    LASER = "Laser",
    FLAME = "Flame",
    CO2_JET = "CO2 Jet",
    COLD_SPARK = "Cold Spark",
    FOG = "Fog / Haze",
}

// ---------------------------------------------------------------------------------------------------------------
// Configs
// ---------------------------------------------------------------------------------------------------------------

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

/** GENERIC: emitters, pixel/multi-cell fixtures, strobes, blinders (replaces GenericVisualizationConfig). */
export interface GenericVisualizationConfig {
    mapping: CapabilityMapping;
    /** Contribute a wide light to surfaces (strobes, blinders, bars); default true for those models. */
    surfaceLight: boolean;
    /** Light cone angle in degrees for the surface light, default 90 (blinders) / 120 (strobes). */
    lightAngle: number;
}

export interface StripPathPoint {
    /** Object-local position, meters. */
    position: Vec3;
    /** Emission direction (surface normal at the click), object-local unit vector. */
    normal: Vec3;
}

export interface StripPath {
    /** At least 2 points. */
    points: StripPathPoint[];
    interpolation: "linear" | "curve";
    closed: boolean;
}

/** LED_STRIP (start/end replaced by path; converted on load). */
export interface LedStripVisualizationConfig {
    /** 0..1 */
    intensity: number;
    path: StripPath;
    /** Pixel size relative to the pitch, 0.2..1, default 0.6. */
    pixelSize: number;
}

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
    beams: number; // 1..64
    spread: number; // degrees, fan/cone opening
    color: string; // "#rrggbb" when no color is mapped
}
export interface FlameOptions {
    kind: "flame";
    maxHeight: number; // meters, default 3
}
export interface JetOptions {
    kind: "co2";
    maxHeight: number; // default 6
}
export interface SparkOptions {
    kind: "spark";
    maxHeight: number; // default 3
}
export interface FogOptions {
    kind: "fog";
    fogType: "fog" | "haze";
    /** Contribution of full output to the effective haze when coupling is on (research R13), 0..1, default 0.5. */
    hazeContribution: number;
}

/** Discriminated union of FixtureVisualizationObject after this feature. */
export type FixtureVisualizationConfigByType =
    | { visualizationType: VisualizationType.MOVING_HEAD | VisualizationType.SPOT; config: BeamVisualizationConfig }
    | { visualizationType: VisualizationType.GENERIC; config: GenericVisualizationConfig }
    | { visualizationType: VisualizationType.LED_STRIP; config: LedStripVisualizationConfig }
    | {
          visualizationType:
              | VisualizationType.LASER
              | VisualizationType.FLAME
              | VisualizationType.CO2_JET
              | VisualizationType.COLD_SPARK
              | VisualizationType.FOG;
          config: EffectVisualizationConfig;
      };

// ---------------------------------------------------------------------------------------------------------------
// Asset catalog delta (feature 002 contract, src/assetLibrary)
// ---------------------------------------------------------------------------------------------------------------

/**
 * - `FixtureModelDescription.visualizationTypes` of the effect models gain the new types:
 *     fixture.laser → [LASER, GENERIC], fixture.flame-projector → [FLAME, GENERIC], fixture.co2-jet → [CO2_JET, GENERIC],
 *     fixture.cold-spark → [COLD_SPARK, GENERIC], fixture.fog-machine → [FOG, GENERIC].
 * - Effect models get a `beam` description at their nozzle (origin and direction of the effect).
 * - FixtureBody gains `setCellColors(colors: Float32Array)` (RGB triplets in emitter order of the description) and
 *   `emitterIds: readonly string[]` (see contracts/renderer-api.ts).
 * - The validator requires `beam` for models listing a beam or effect visualization type.
 */
export type CatalogDelta = never;
