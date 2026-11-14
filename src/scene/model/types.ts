/**
 * Scene data model (feature 001-scene-editor, extended by feature 002-asset-library). Mirrors
 * specs/001-scene-editor/contracts/scene-state.ts and specs/002-asset-library/contracts/scene-state-delta.ts.
 *
 * Conventions: meters, degrees, +Y up, floor at y = 0, Euler order XYZ, transforms relative to the parent.
 * This module is shared by the main window and the show window and must stay free of Pinia/Vue imports.
 */
import { VisualizationType } from "@/visualization/fixtureVisualization";
import type { LedStripVisualizationConfig, StripPath, StripPathPoint } from "@/visualization/fixtureVisualizations/ledStrip/types";
import type { BeamVisualizationConfig, MovementSettings } from "@/visualization/fixtureVisualizations/beam/types";
import type { GenericVisualizationConfig } from "@/visualization/fixtureVisualizations/generic/types";
import type {
    EffectVisualizationConfig,
    FlameOptions,
    FogOptions,
    JetOptions,
    LaserOptions,
    SparkOptions,
} from "@/visualization/fixtureVisualizations/effects/types";
import type { MaterialPresetId, ParamValues } from "@/assetLibrary/types";

export type Vec3 = [number, number, number];

export { VisualizationType };
export type {
    LedStripVisualizationConfig,
    StripPath,
    StripPathPoint,
    BeamVisualizationConfig,
    MovementSettings,
    GenericVisualizationConfig,
    EffectVisualizationConfig,
    LaserOptions,
    FlameOptions,
    JetOptions,
    SparkOptions,
    FogOptions,
};
export type { MaterialPresetId, ParamValues };

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

export interface SceneObjectBase<K extends string> {
    id: string;
    name: string;
    kind: K;
    parentId: string | null;
    /** Order of children in the outliner; consistent with the children's parentId. */
    children: string[];
    position: Vec3;
    /** Degrees, Euler XYZ. */
    rotation: Vec3;
    /** Each component >= 0.01. */
    scale: Vec3;
    visible: boolean;
    locked: boolean;
}

export type ShapeType = "box" | "cylinder" | "plane" | "sphere";

export type ShapeDimensions =
    | { shape: "box"; dimensions: { width: number; height: number; depth: number } }
    | { shape: "cylinder"; dimensions: { radius: number; height: number } }
    | { shape: "plane"; dimensions: { width: number; depth: number } }
    | { shape: "sphere"; dimensions: { radius: number } };

export type ShapeObject = SceneObjectBase<"shape"> &
    ShapeDimensions & {
        /** "#rrggbb" */
        color: string;
        /** Material preset (feature 002), null = plain color. */
        material: MaterialPresetId | null;
    };

/** Fields added to every FixtureVisualizationObject variant by feature 002. */
export interface FixtureVisualizationModelFields {
    /** Catalog id of a model compatible with `visualizationType` (unknown ids are kept, FR-070). */
    modelId: string;
    /** Uniform body scale, 0.25..4, default 1 (FR-015). */
    modelScale: number;
}

/** Config by visualization type (feature 003, contracts/scene-state-delta.ts). */
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

export type FixtureVisualizationObject = SceneObjectBase<"fixtureVisualization"> & {
    /** null = not linked to a fixture (e.g. after duplicate/paste). */
    fixtureId: string | null;
} & FixtureVisualizationModelFields &
    FixtureVisualizationConfigByType;

/** An item of the built-in asset library (feature 002). */
export type LibraryAssetObject = SceneObjectBase<"libraryAsset"> & {
    /** Catalog id; unknown ids are kept and shown as a placeholder (FR-070). */
    assetId: string;
    /** Parametric elements only, otherwise {}. Always complete and within range for known assets. */
    params: ParamValues;
    material: MaterialPresetId | null;
    /** "#rrggbb" override of the "body" slot, null = asset default. */
    color: string | null;
    variant: string | null;
    /** Bounding size at the last edit, used for placeholders. Each component >= 0.01. */
    size: Vec3;
};

export type ImportedModelObject = SceneObjectBase<"importedModel"> & {
    assetId: string;
    /** Scale before auto-scaling on import ("Restore original scale"). */
    originalScale: Vec3;
};

export type GroupObject = SceneObjectBase<"group">;

/** Named point that moving heads can aim at (feature 004, R11). Rotation/scale are ignored; editor-only gizmo. */
export type AimTargetObject = SceneObjectBase<"aimTarget">;

/**
 * Objects of kinds unknown to this version are preserved verbatim
 * (forward compatibility for kinds added by later features).
 */
export type UnknownObject = SceneObjectBase<string> & Record<string, unknown>;

export type SceneObject = ShapeObject | FixtureVisualizationObject | ImportedModelObject | GroupObject | LibraryAssetObject | AimTargetObject;
export type SceneObjectKind = SceneObject["kind"];

const KNOWN_KINDS: ReadonlySet<string> = new Set<SceneObjectKind>(["shape", "fixtureVisualization", "importedModel", "group", "libraryAsset", "aimTarget"]);

export function isKnownKind(kind: string): kind is SceneObjectKind {
    return KNOWN_KINDS.has(kind);
}
export function isShape(obj: { kind: string }): obj is ShapeObject {
    return obj.kind === "shape";
}
export function isFixtureVisualization(obj: { kind: string }): obj is FixtureVisualizationObject {
    return obj.kind === "fixtureVisualization";
}
export function isImportedModel(obj: { kind: string }): obj is ImportedModelObject {
    return obj.kind === "importedModel";
}
export function isLibraryAsset(obj: { kind: string }): obj is LibraryAssetObject {
    return obj.kind === "libraryAsset";
}
export function isAimTarget(obj: { kind: string }): obj is AimTargetObject {
    return obj.kind === "aimTarget";
}

// ---------------------------------------------------------------------------
// Cameras, settings, assets
// ---------------------------------------------------------------------------

export interface CameraPose {
    position: Vec3;
    target: Vec3;
    /** Vertical field of view in degrees, 10..120. */
    fov: number;
}

export interface CameraPosition extends CameraPose {
    id: string;
    name: string;
    /** At most one camera position has this set. */
    isShowDefault: boolean;
}

export interface SceneEditorSettings {
    showGrid: boolean;
    showAxes: boolean;
    showLabels: boolean;
    snapEnabled: boolean;
    /** meters */
    translationSnap: number;
    /** degrees */
    rotationSnap: number;
    scaleSnap: number;
    transformSpace: "world" | "local";
}

export type AmbientPreset = "dark" | "house" | "daylight";

export interface AmbientSetting {
    preset: AmbientPreset;
    /** 0..2, 1 = preset default. */
    brightness: number;
}

/** Look of the room (feature 003, data-model §4). */
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

export interface SceneAssetPersisted {
    id: string;
    /** Original file name. */
    name: string;
    mimeType: "model/gltf-binary";
    /** base64-encoded file content. */
    data: string;
}

export interface SceneAsset {
    id: string;
    name: string;
    mimeType: "model/gltf-binary";
    data: Uint8Array;
}

// ---------------------------------------------------------------------------
// Scene state
// ---------------------------------------------------------------------------

interface SceneStateBase {
    formatVersion: 1;
    objects: Record<string, SceneObject>;
    /** Order of top-level objects in the outliner. */
    rootOrder: string[];
    cameras: CameraPosition[];
    editorCamera: CameraPose;
    settings: SceneEditorSettings;
    /** Haze and ambient light (feature 003, data-model §4). */
    environment: SceneEnvironment;
}

/** In-memory scene. */
export interface SceneState extends SceneStateBase {
    assets: Record<string, SceneAsset>;
}

/** Scene as written into project files. */
export interface PersistedSceneState extends SceneStateBase {
    assets: Record<string, SceneAssetPersisted>;
}

/** Scene without asset bytes, as sent to show windows in a snapshot. */
export type SceneSnapshot = SceneStateBase;

/** Previous format, only read by the one-time converter. */
export interface LegacyStageVisualization {
    baseScene: unknown;
    visualizationStates: Record<string, { type: VisualizationType; config: unknown }>;
}
