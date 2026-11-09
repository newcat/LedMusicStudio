/**
 * Contract: built-in asset catalog and fixture model contract (feature 002-asset-library).
 *
 * Implemented in src/assetLibrary/types.ts. The module must stay free of Pinia/Vue imports, because the show window
 * (visualization.html) uses it too. Units: meters, degrees, +Y up. See data-model.md for the rules and ranges.
 */
import type * as THREE from "three";
import type { VisualizationType } from "@/visualization/fixtureVisualization";
import type { Fixture as OflFixture } from "@/stage/fixtures/dmx/open-fixture";

export type Vec3 = [number, number, number];
export type Axis = "x" | "y" | "z";
export type OflCategory = OflFixture["categories"][number];

// ---------------------------------------------------------------------------------------------------------------
// Asset definition
// ---------------------------------------------------------------------------------------------------------------

export type AssetCategory = "fixtures" | "stage" | "decoration" | "shapes";

export type License = "GPL-3.0-or-later" | "CC0-1.0" | "CC-BY-4.0" | "Apache-2.0" | "MIT";

export interface Credits {
    author: string;
    /** URL, or "LEDMusic Studio" for assets made for the project. */
    source: string;
    license: License;
    /** true implies license "GPL-3.0-or-later". */
    madeForProject: boolean;
}

/** Names of recolorable mesh groups. Builders tag meshes with `userData.slot`; GLB meshes use the material name. */
export type MaterialSlot = "body" | "accent" | "metal" | "fabric" | "glass" | "screen" | (string & {});

export interface ColorVariant {
    id: string;
    name: string;
    /** "#rrggbb" per slot */
    slots: Partial<Record<MaterialSlot, string>>;
}

export type MaterialPresetId =
    | "stage-floor-black"
    | "wood"
    | "metal-brushed"
    | "fabric-black"
    | "fabric-white"
    | "concrete"
    | "plastic-glossy";

export interface MaterialPreset {
    id: MaterialPresetId;
    name: string;
    color: string;
    roughness: number;
    metalness: number;
    sheen?: number;
    clearcoat?: number;
    /** Strength of the dielectric specular reflection (MeshPhysicalMaterial.specularIntensity, default 1). */
    specularIntensity?: number;
}

interface AssetDefinitionBase<C extends AssetCategory, S extends AssetSource> {
    /** Stable id, `^[a-z]+(\.[a-z0-9-]+)+$`, never reused. */
    id: string;
    name: string;
    category: C;
    keywords: string[];
    /** Bounding box W×H×D at default parameters (validator tolerance ±15 %). */
    defaultSize: Vec3;
    /** "asset-library/previews/<id>.webp" */
    preview: string;
    credits: Credits;
    source: S;
    materialSlots?: MaterialSlot[];
    /** "#rrggbb" per slot for the default look (variant `null`); slots without an entry use the global slot style. */
    defaultColors?: Partial<Record<MaterialSlot, string>>;
    variants?: ColorVariant[];
    /** Parametric stage elements and shapes: accepts a material preset (FR-050). */
    supportsMaterial?: boolean;
    /** Static mounting data (parametric sources provide functions instead). */
    mounting?: { areas?: MountingArea[]; connections?: ConnectionPoint[] };
}

export type FixtureAssetDefinition = AssetDefinitionBase<"fixtures", GlbSource | ProceduralSource | ParametricSource> & {
    fixture: FixtureModelDescription;
};
export type StageAssetDefinition = AssetDefinitionBase<"stage", ParametricSource | ProceduralSource | GlbSource>;
export type DecorationAssetDefinition = AssetDefinitionBase<"decoration", ProceduralSource | GlbSource>;
export type ShapeAssetDefinition = AssetDefinitionBase<"shapes", ShapeSource>;

export type AssetDefinition = FixtureAssetDefinition | StageAssetDefinition | DecorationAssetDefinition | ShapeAssetDefinition;

// ---------------------------------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------------------------------

export interface GlbSource {
    type: "glb";
    /** Relative to the app base: "asset-library/models/<file>.glb" */
    file: string;
}

export interface ProceduralSource {
    type: "procedural";
    /** Deterministic. Meshes carry `userData.slot`. Nodes named in the fixture description must exist. */
    build: (kit: BuilderKit) => THREE.Object3D;
}

export type ParamSpec =
    | { key: string; label: string; type: "number"; min: number; max: number; step: number; unit: "m" | "deg" | ""; default: number }
    | { key: string; label: string; type: "choice"; options: Array<{ value: string; label: string }>; default: string };

export type ParamValues = Record<string, number | string>;

export interface ParametricSource {
    type: "parametric";
    params: ParamSpec[];
    /** Pure, no Three.js: the store uses it to keep `LibraryAssetObject.size` current. */
    size: (p: ParamValues) => Vec3;
    build: (p: ParamValues, kit: BuilderKit) => THREE.Object3D;
    mountingAreas?: (p: ParamValues) => MountingArea[];
    connections?: (p: ParamValues) => ConnectionPoint[];
}

export interface ShapeSource {
    type: "shape";
    shape: "box" | "cylinder" | "plane" | "sphere";
}

/** Shared helpers for procedural/parametric builders (implemented in src/assetLibrary/builders/kit.ts). */
export interface BuilderKit {
    box(size: Vec3, slot: MaterialSlot, opts?: { bevel?: number }): THREE.Mesh;
    cylinder(radiusTop: number, radiusBottom: number, height: number, slot: MaterialSlot, segments?: number): THREE.Mesh;
    tube(from: Vec3, to: Vec3, radius: number, slot: MaterialSlot): THREE.Mesh;
    lathe(profile: Array<[number, number]>, slot: MaterialSlot, segments?: number): THREE.Mesh;
    group(name: string, ...children: THREE.Object3D[]): THREE.Group;
    /** Merges all meshes below `root` per slot, except subtrees whose root name is in `keep` (moving parts). */
    mergeBySlot(root: THREE.Object3D, keep?: string[]): THREE.Object3D;
}

// ---------------------------------------------------------------------------------------------------------------
// Fixture model contract (FR-010, FR-011)
// ---------------------------------------------------------------------------------------------------------------

export interface MovingPart {
    /** Node name; the node origin is the pivot. */
    node: string;
    axis: Axis;
    /** Physical limits in degrees, used as default channel mapping range. */
    min: number;
    max: number;
}

export interface BeamDescription {
    /** "" = model root. Emitters and beam of moving heads hang on the tilt node. */
    node: string;
    /** Lens center in the node frame. */
    position: Vec3;
    /** Unit vector in the node frame; at rest it points to +Y of the model (research R3). */
    direction: Vec3;
}

export type Emitter = {
    /** Unique; multi-cell models use "cell-<n>" or "cell-<row>-<col>" (FR-023). */
    id: string;
    node: string;
    position: Vec3;
    /** Unit vector, emitting side. */
    normal: Vec3;
} & ({ shape: "circle"; radius: number } | { shape: "rect"; size: [number, number]; up: Vec3 });

export interface MountingPoint {
    id: string;
    node: string;
    position: Vec3;
    /** Outward normal of the clamp face, e.g. [0, -1, 0] for a base plate. */
    direction: Vec3;
}

export interface FixtureModelDescription {
    visualizationTypes: VisualizationType[];
    categories: OflCategory[];
    movingParts?: { pan?: MovingPart; tilt?: MovingPart };
    beam?: BeamDescription;
    /** meters, > 0 */
    lensRadius: number;
    emitters: Emitter[];
    mountingPoints: MountingPoint[];
    /** Only for LED strip bodies. */
    ledStrip?: { profileWidth: number; profileHeight: number };
}

// ---------------------------------------------------------------------------------------------------------------
// Mounting & connections (FR-040–042)
// ---------------------------------------------------------------------------------------------------------------

export type MountMode = "hang" | "stand";

export type MountingArea =
    | { id: string; type: "line"; start: Vec3; end: Vec3; radius: number; modes: MountMode[] }
    | { id: string; type: "surface"; center: Vec3; size: [number, number]; normal: Vec3; modes: ["stand"] };

export interface ConnectionPoint {
    id: string;
    position: Vec3;
    /** Points out of the element. */
    direction: Vec3;
    up: Vec3;
    /** Only equal types connect, e.g. "truss.square-290". */
    type: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Catalog API (src/assetLibrary/catalog.ts)
// ---------------------------------------------------------------------------------------------------------------

export interface AssetCatalog {
    all(): readonly AssetDefinition[];
    get(id: string): AssetDefinition | undefined;
    /** Case-insensitive, all words must match name, category or keywords. */
    search(query: string): AssetDefinition[];
    /** Valid fixture models whose description lists `type` (invalid ones are filtered out, research R10). */
    modelsFor(type: VisualizationType): FixtureAssetDefinition[];
    defaultModelFor(type: VisualizationType): FixtureAssetDefinition;
}

export interface ValidationIssue {
    assetId: string;
    severity: "error" | "warning";
    message: string;
}

/** src/assetLibrary/validate.ts; `template` enables geometry checks (workbench, runtime safety net). */
export type ValidateAsset = (definition: AssetDefinition, template?: THREE.Object3D) => ValidationIssue[];

/** src/assetLibrary/categoryMapping.ts (research R13). */
export interface FixturePreselection {
    visualizationType: VisualizationType;
    modelId: string;
    /** 1 if no plausible dimensions are known. */
    modelScale: number;
}
export type PreselectForFixture = (definition: OflFixture | null, mode: OflFixture["modes"][number] | null) => FixturePreselection;
