/**
 * Contract: changes to the persisted scene format (feature 002-asset-library).
 *
 * Extends specs/001-scene-editor/contracts/scene-state.ts and is implemented in src/scene/model/types.ts.
 * `formatVersion` stays 1: the changes are additive, and sanitize.ts fills in the defaults for files saved by 001
 * (data-model.md, "Load rules"). Project files written by 002 can still be opened, but older builds show
 * `libraryAsset` objects as unknown-kind placeholders (001 forward compatibility).
 */
import type { SceneObjectBase, ShapeDimensions, Vec3 } from "../../001-scene-editor/contracts/scene-state";
import type { MaterialPresetId, ParamValues } from "./asset-catalog";

// --- new kind ---------------------------------------------------------------------------------------------------

export type LibraryAssetObject = SceneObjectBase<"libraryAsset"> & {
    /** Catalog id; unknown ids are kept and shown as a placeholder (FR-070). */
    assetId: string;
    /** Parametric elements only, otherwise {}. Always complete and within range for known assets. */
    params: ParamValues;
    material: MaterialPresetId | null;
    /** "#rrggbb" override of the "body" slot, null = asset default. */
    color: string | null;
    variant: string | null;
    /** Bounding size at the last edit, used for placeholders. */
    size: Vec3;
};

// --- changed kinds ----------------------------------------------------------------------------------------------

export type ShapeObject = SceneObjectBase<"shape"> &
    ShapeDimensions & {
        color: string;
        /** new in 002, null = plain color */
        material: MaterialPresetId | null;
    };

/** Fields added to every FixtureVisualizationObject variant. */
export interface FixtureVisualizationModelFields {
    /** Catalog id of a model compatible with `visualizationType`. */
    modelId: string;
    /** Uniform body scale, 0.25..4, default 1 (FR-015). */
    modelScale: number;
}

export interface GenericVisualizationConfig {
    channelMapping: {
        /** 0..1 after mapping; unmapped = full (defaultValue 1). */
        intensity: { channel: number; defaultValue: number; min: number; max: number };
        /** DMX channel indices, -1 = not mapped; no color mapped = white. */
        red: number;
        green: number;
        blue: number;
        white: number;
    };
}

/** VisualizationType gains: GENERIC = "Generic Fixture" with config GenericVisualizationConfig. */
export type VisualizationTypeAdditions = "Generic Fixture";

// SceneObject = ShapeObject | FixtureVisualizationObject (with model fields) | ImportedModelObject | GroupObject
//             | LibraryAssetObject
