import { v4 as uuidv4 } from "uuid";

import type { VisualizationType } from "@/visualization/fixtureVisualization";
import { assetCatalog } from "@/assetLibrary/catalog";
import { completeParams, sizeOf } from "@/assetLibrary/params";
import type { AssetDefinition } from "@/assetLibrary/types";
import type {
    CameraPose,
    FixtureVisualizationModelFields,
    FixtureVisualizationObject,
    GroupObject,
    ImportedModelObject,
    LibraryAssetObject,
    SceneEditorSettings,
    SceneObjectBase,
    SceneState,
    ShapeObject,
    ShapeType,
} from "./types";

export const DEFAULT_SHAPE_COLOR = "#9e9e9e";

/** Range of `FixtureVisualizationObject.modelScale` (FR-015). */
export const MODEL_SCALE_MIN = 0.25;
export const MODEL_SCALE_MAX = 4;

export function createDefaultSettings(): SceneEditorSettings {
    return {
        showGrid: true,
        showAxes: true,
        showLabels: false,
        snapEnabled: false,
        translationSnap: 0.25,
        rotationSnap: 15,
        scaleSnap: 0.1,
        transformSpace: "world",
    };
}

export function createDefaultCameraPose(): CameraPose {
    return { position: [8, 6, 12], target: [0, 1, 0], fov: 50 };
}

function baseFields<K extends string>(kind: K, name: string): SceneObjectBase<K> {
    return {
        id: uuidv4(),
        name,
        kind,
        parentId: null,
        children: [],
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        visible: true,
        locked: false,
    };
}

export const SHAPE_LABELS: Record<ShapeType, string> = {
    box: "Box",
    cylinder: "Cylinder",
    plane: "Plane",
    sphere: "Sphere",
};

export function defaultShapeDimensions(shape: ShapeType): Pick<ShapeObject, "shape" | "dimensions"> {
    switch (shape) {
        case "box":
            return { shape, dimensions: { width: 1, height: 1, depth: 1 } };
        case "cylinder":
            return { shape, dimensions: { radius: 0.5, height: 1 } };
        case "plane":
            return { shape, dimensions: { width: 2, depth: 2 } };
        case "sphere":
            return { shape, dimensions: { radius: 0.5 } };
    }
}

export function createShapeObject(shape: ShapeType, partial: Partial<Omit<ShapeObject, "shape" | "kind">> = {}): ShapeObject {
    return {
        ...baseFields("shape", SHAPE_LABELS[shape]),
        ...defaultShapeDimensions(shape),
        color: DEFAULT_SHAPE_COLOR,
        material: null,
        ...partial,
    } as ShapeObject;
}

export function createGroupObject(partial: Partial<GroupObject> = {}): GroupObject {
    return { ...baseFields("group", "Group"), ...partial };
}

export function createImportedModelObject(assetId: string, name: string): ImportedModelObject {
    return { ...baseFields("importedModel", name), assetId, originalScale: [1, 1, 1] };
}

export function createFixtureVisualizationObject(
    fixtureId: string | null,
    visualizationType: VisualizationType,
    config: FixtureVisualizationObject["config"],
    name = "Fixture",
    model?: Partial<FixtureVisualizationModelFields>
): FixtureVisualizationObject {
    return {
        ...baseFields("fixtureVisualization", name),
        fixtureId,
        visualizationType,
        config,
        modelId: model?.modelId ?? assetCatalog.defaultModelFor(visualizationType).id,
        modelScale: model?.modelScale ?? 1,
    } as FixtureVisualizationObject;
}

/** Parametric library assets get their size from the parameters; their scale stays [1, 1, 1] (feature 002, T078). */
export function isParametricLibraryAsset(obj: { kind: string; assetId?: unknown } | undefined): boolean {
    if (!obj || obj.kind !== "libraryAsset" || typeof obj.assetId !== "string") {
        return false;
    }
    return assetCatalog.get(obj.assetId)?.source.type === "parametric";
}

/** A library item at default parameters. The caller passes the name (`nextObjectName(scene, definition.name)`). */
export function createLibraryAssetObject(definition: AssetDefinition, partial: Partial<Omit<LibraryAssetObject, "kind">> = {}): LibraryAssetObject {
    const params = completeParams(definition, {});
    return {
        ...baseFields("libraryAsset", definition.name),
        assetId: definition.id,
        params,
        material: null,
        color: null,
        variant: null,
        size: sizeOf(definition, params),
        ...partial,
    };
}

/** Returns e.g. "Box 3": one more than the highest number used by an existing name with this label. */
export function nextObjectName(scene: Pick<SceneState, "objects">, baseLabel: string): string {
    let max = 0;
    const prefix = `${baseLabel} `;
    for (const obj of Object.values(scene.objects)) {
        if (obj.name === baseLabel) {
            max = Math.max(max, 1);
        } else if (obj.name.startsWith(prefix)) {
            const n = Number(obj.name.slice(prefix.length));
            if (Number.isInteger(n)) {
                max = Math.max(max, n);
            }
        }
    }
    return `${baseLabel} ${max + 1}`;
}

export function createDefaultScene(): SceneState {
    const floor = createShapeObject("plane", { name: "Floor", color: "#3a3a3a", dimensions: { width: 20, depth: 20 } } as Partial<ShapeObject>);
    const pose = createDefaultCameraPose();
    return {
        formatVersion: 1,
        objects: { [floor.id]: floor },
        rootOrder: [floor.id],
        cameras: [{ id: uuidv4(), name: "Default", ...pose, isShowDefault: true }],
        editorCamera: createDefaultCameraPose(),
        settings: createDefaultSettings(),
        assets: {},
    };
}
