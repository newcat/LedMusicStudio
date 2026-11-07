/**
 * Contract: persisted scene format (feature 001-scene-editor).
 *
 * This is the shape written into the project file under `stage.scene` and into
 * stage export files. Implementation lives in `src/scene/model/types.ts`; this file
 * is the reference for review and for features 002/003, which add object kinds.
 *
 * Conventions: meters, degrees, +Y up, floor at y = 0, Euler order XYZ,
 * transforms relative to the parent. See data-model.md.
 */

export type Vec3 = [number, number, number];

export interface SceneState {
    formatVersion: 1;
    objects: Record<string, SceneObject>;
    /** Order of top-level objects in the outliner. */
    rootOrder: string[];
    cameras: CameraPosition[];
    editorCamera: CameraPose;
    settings: SceneEditorSettings;
    assets: Record<string, SceneAssetPersisted>;
}

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
    };

export type VisualizationType = "Led Strip" | "Spot" | "Moving Head";

export interface ChannelMapping {
    channel: number;
    defaultValue: number;
    min: number;
    max: number;
}

export interface MovingHeadConfig {
    channelMapping: {
        pan: ChannelMapping;
        tilt: ChannelMapping;
        beamAngle: ChannelMapping;
        red: number;
        green: number;
        blue: number;
    };
}

export interface SpotConfig {
    /** Channel index per color, -1 = unused. Emits along local -Y. */
    colorChannels: [number, number, number, number];
}

export interface LedStripConfig {
    intensity: number;
    /** Object-local endpoints in meters. Emits along local +Y. */
    start: Vec3;
    end: Vec3;
}

export type FixtureVisualizationObject = SceneObjectBase<"fixtureVisualization"> & {
    /** null = not linked to a fixture (e.g. after duplicate/paste). */
    fixtureId: string | null;
} & (
        | { visualizationType: "Moving Head"; config: MovingHeadConfig }
        | { visualizationType: "Spot"; config: SpotConfig }
        | { visualizationType: "Led Strip"; config: LedStripConfig }
    );

export type ImportedModelObject = SceneObjectBase<"importedModel"> & {
    assetId: string;
    /** Scale before auto-scaling on import ("Restore original scale"). */
    originalScale: Vec3;
};

export type GroupObject = SceneObjectBase<"group">;

/**
 * Objects of kinds unknown to this version are preserved verbatim
 * (forward compatibility for feature 002 "libraryAsset" etc.).
 */
export type UnknownObject = SceneObjectBase<string> & Record<string, unknown>;

export type SceneObject = ShapeObject | FixtureVisualizationObject | ImportedModelObject | GroupObject;

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

export interface SceneAssetPersisted {
    id: string;
    /** Original file name. */
    name: string;
    mimeType: "model/gltf-binary";
    /** base64-encoded file content. In memory: Uint8Array. */
    data: string;
}

// ---------------------------------------------------------------------------
// Project integration
// ---------------------------------------------------------------------------

/** Replaces the previous `{ fixtures, controllers, visualization }`. */
export interface StageStateV2 {
    fixtures: unknown[];
    controllers: unknown[];
    scene: SceneState;
}

/** Previous format, only read by the one-time converter. */
export interface LegacyStageVisualization {
    baseScene: unknown;
    visualizationStates: Record<string, { type: VisualizationType; config: unknown }>;
}
