/**
 * Internal rendering API of feature 003: the view (SceneView), per-view services (SurfaceLighting, quality,
 * environment), the renderer base class and the decoded fixture states. Implemented in src/visualization/**.
 * Nothing here may import Pinia stores or editor code (dependency rule from 001/002).
 */
import type * as THREE from "three";
import type { AssetCache } from "@/assetLibrary/assetCache";
import type { SceneEnvironment, AmbientSetting } from "./scene-state-delta";
import type { LaserPattern } from "./capability-mapping";

// ---------------------------------------------------------------------------------------------------------------
// Quality & preferences (src/visualization/quality.ts, viewPreferences.ts — research R12, R16)
// ---------------------------------------------------------------------------------------------------------------

export type QualityLevel = "low" | "medium" | "high";
export type ViewKind = "editor" | "show";

export interface QualityProfile {
    level: QualityLevel;
    /** Multiplied with min(devicePixelRatio, pixelRatioCap). */
    pixelRatioScale: number;
    pixelRatioCap: number;
    msaaSamples: 0 | 2 | 4;
    bloomMips: number;
    fullLights: number;
    simpleLights: number;
    shadowLights: number;
    shadowTileSize: 512;
    stripSegments: number;
    beamRadialSegments: number;
    hazeOctaves: number;
    particlesPerEffect: number;
    laserBeamsPerFixture: number;
}
export declare const QUALITY_PROFILES: Record<QualityLevel, QualityProfile>;

export interface ViewPreferences {
    editor: { quality: QualityLevel; showFps: boolean };
    show: { quality: QualityLevel; showFps: boolean };
    /** FR-061, default true */
    photosensitivityLimit: boolean;
    /** Ignore the limit and show the true strobe rate, default false */
    showTrueStrobeRate: boolean;
}

/** localStorage["lms.viewPreferences"], synchronized across windows via the `storage` event. */
export interface ViewPreferencesStore {
    get(): ViewPreferences;
    update(patch: Partial<ViewPreferences> | ((p: ViewPreferences) => void)): void;
    subscribe(cb: (p: ViewPreferences) => void): () => void;
}

/** Device limits checked at view start (research R12, FR-055). */
export interface DeviceSupport {
    floatRenderTargets: boolean;
    maxTextureUnits: number;
    maxTextureSize: number;
}

/** A feature that was downgraded on this device; the HUD shows each notice once per view. */
export interface FallbackNotice {
    feature: "shadows" | "gobos" | "lights" | "msaa" | "bloom";
    message: string;
}

// ---------------------------------------------------------------------------------------------------------------
// SceneView additions (src/visualization/sceneView.ts)
// ---------------------------------------------------------------------------------------------------------------

export interface SceneViewOptions {
    showEditorProxies: boolean;
    /** Selects quality preference and ambient setting. */
    kind: ViewKind;
}

export interface FrameStats {
    fps: number;
    frameMs: number;
}

export interface SceneViewDelta {
    /** FR-053: inactive views do not render and only store the latest values. */
    setActive(active: boolean): void;
    readonly active: boolean;
    /** FR-054: stores the value; applied once at the start of the next frame. */
    setFixtureValue(objectId: string, value: Uint8Array): void;
    setEnvironment(environment: SceneEnvironment): void;
    setQuality(level: QualityLevel): void;
    /** Strobe limits from the preferences (research R5). */
    setFlashLimit(limitHz: number | null): void;
    onFrameStats(cb: (stats: FrameStats) => void): () => void;
    onNotice(cb: (notice: FallbackNotice) => void): () => void;
    /** For editor tools (strip drawing): surface hit incl. normal, ignoring beams/emitters/particles. */
    raycastSurfaces(ndc: { x: number; y: number }): { point: THREE.Vector3; normal: THREE.Vector3; objectId: string | null } | null;
}

// ---------------------------------------------------------------------------------------------------------------
// Per-view services handed to renderers
// ---------------------------------------------------------------------------------------------------------------

export interface FrameContext {
    /** Seconds since view start (monotonic), and seconds since the previous frame (clamped to 0.1). */
    time: number;
    dt: number;
    /** Measured display frame rate (research R5). */
    fps: number;
    /** Effective haze 0..1 incl. hazer coupling (research R13). */
    haze: number;
    /** Max flash rate in Hz, null = unlimited. */
    flashLimit: number | null;
    quality: QualityProfile;
}

export interface RendererInputs {
    camera: THREE.Camera;
    assets: AssetCache;
    lighting: SurfaceLighting;
    environment: EnvironmentState;
    /** Static meshes for beam-length and laser raycasts (research R11). */
    raycastTargets: () => readonly THREE.Object3D[];
}

/** Replaces BaseRenderer's per-message updates with a per-frame update (FR-054). */
export interface BaseRendererDelta {
    onConfigUpdate(config: unknown): void;
    /** Called at most once per frame with the latest raw value (research R1). */
    onFixtureValueUpdate(value: Uint8Array): void;
    /** Called every frame while the view is active, after world matrices are updated. Replaces updateWorld(). */
    update(frame: FrameContext): void;
    // removed: getSurfaceLight() — lights go into SurfaceLighting (research R7)
}

// ---------------------------------------------------------------------------------------------------------------
// SurfaceLighting (src/visualization/lighting/surfaceLighting.ts — research R7, R10, R11)
// ---------------------------------------------------------------------------------------------------------------

export type LightHandle = number & { readonly __light: unique symbol };
export type StripHandle = number & { readonly __strip: unique symbol };

export interface SpotLightParams {
    type: "spot";
    /** World space. */
    position: THREE.Vector3;
    direction: THREE.Vector3;
    /** Linear RGB × intensity (may exceed 1). */
    color: THREE.Color;
    /** Full beam angle, degrees. */
    angle: number;
    /** 0 = hard edge, 1 = very soft. */
    softness: number;
    /** meters; light ends here (beam length / first hit + margin). */
    range: number;
    /** Gobo atlas tile from GoboAtlas.acquire, or −1. */
    goboTile: number;
    /** radians */
    goboRotation: number;
    /** 0 = no prism; 3..8 */
    prismFacets: number;
    prismRotation: number;
    prismSpread: number;
}

export interface OmniLightParams {
    type: "omni";
    position: THREE.Vector3;
    color: THREE.Color;
    range: number;
}

export interface StripSegmentsSource {
    /** World-space pixel positions and normals (xyz per pixel) and 0..255 RGB per pixel, same length/3. */
    readonly worldPositions: Float32Array;
    readonly worldNormals: Float32Array;
    readonly colors: Uint8Array;
    readonly visible: boolean;
}

export interface SurfaceLighting {
    /** Shared by every LED-lit material of the view (createLedLitMaterial). */
    readonly uniforms: Record<string, THREE.IUniform>;
    readonly defines: Record<string, string | number>;
    readonly gobos: GoboAtlas;

    addLight(): LightHandle;
    /** Called by renderers in update(); intensity 0 = off this frame. */
    setLight(handle: LightHandle, params: SpotLightParams | OmniLightParams): void;
    removeLight(handle: LightHandle): void;

    addStrip(source: StripSegmentsSource): StripHandle;
    removeStrip(handle: StripHandle): void;

    /** Once per frame before rendering: prioritization (FR-023), texture uploads, shadow tiles (high quality). */
    update(camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: QualityProfile): void;
    setAmbient(color: THREE.Color): void;
    dispose(): void;
}

/** src/visualization/lighting/goboAtlas.ts (research R9). */
export interface GoboAtlas {
    readonly texture: THREE.Texture;
    /** SVG markup or "generic:<n>"; resolves to a tile index; images that fail to load use a generic pattern. */
    acquire(image: string): number;
    release(tile: number): void;
}

// ---------------------------------------------------------------------------------------------------------------
// Environment state (src/visualization/environment.ts — research R13)
// ---------------------------------------------------------------------------------------------------------------

export interface EnvironmentState {
    readonly settings: SceneEnvironment;
    /** Effective haze for this frame. */
    readonly haze: number;
    /** Fog renderers report their output each frame (0..1 × contribution). */
    reportHazeOutput(objectId: string, amount: number): void;
    ambientFor(kind: ViewKind): AmbientSetting;
}

// ---------------------------------------------------------------------------------------------------------------
// Decoded states (src/visualization/capabilities/*State.ts — research R1, R4–R6, R14)
// ---------------------------------------------------------------------------------------------------------------

export interface BeamState {
    /** Targets in degrees (before realistic movement). */
    pan: number;
    tilt: number;
    /** 0..1 final intensity incl. dimmer and shutter/strobe gate. */
    intensity: number;
    /** Linear RGB of the mix, wheel, temperature (not multiplied by intensity). */
    color: THREE.Color;
    /** Second color of a split wheel slot, null otherwise. */
    splitColor: THREE.Color | null;
    /** Full beam angle in degrees (target, before smoothing). */
    beamAngle: number;
    /** Gobo image of the current slot (SVG or "generic:<n>"), null = open. */
    gobo: string | null;
    /** Next slot's image and blend factor while the wheel is between slots. */
    goboNext: string | null;
    goboBlend: number;
    goboRotation: number;
    prismFacets: number;
    prismRotation: number;
}

export interface CellState {
    /** RGB triplets (linear, × intensity) in emitter order of the model description. */
    colors: Float32Array;
    /** Average color × intensity for the surface light. */
    average: THREE.Color;
    intensity: number;
}

export type EffectState =
    | {
          kind: "laser";
          on: boolean;
          intensity: number;
          color: THREE.Color;
          pattern: LaserPattern;
          beams: number;
          size: number;
          rotation: number;
          x: number;
          y: number;
      }
    | { kind: "flame" | "co2" | "spark"; on: boolean; height: number }
    | { kind: "fog"; output: number };

// ---------------------------------------------------------------------------------------------------------------
// FixtureBody delta (src/assetLibrary/fixtureBody.ts, feature 002 contract)
// ---------------------------------------------------------------------------------------------------------------

export interface FixtureBodyDelta {
    /** Emitter ids in description order; index i ↔ colors[3i..3i+2] of setCellColors. */
    readonly emitterIds: readonly string[];
    /** Writes all emitter colors at once (merged or individual meshes); values > 1 bloom. */
    setCellColors(colors: Float32Array): void;
}

// ---------------------------------------------------------------------------------------------------------------
// Scene sinks (src/scene/sceneSink.ts — research R15)
// ---------------------------------------------------------------------------------------------------------------

export interface SceneSinkDelta {
    /** False while no consumer is visible; VisualizationServer does not send values to inactive sinks. */
    readonly active: boolean;
    /** Fired when `active` turns true; the server then sends the full fixture state. */
    onActivated(cb: () => void): () => void;
    environmentChanged(environment: SceneEnvironment): void;
    fixtureValues(values: Record<string, Uint8Array>): void;
}
