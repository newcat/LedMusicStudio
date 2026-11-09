import { Matrix4 } from "three";
import { v4 as uuidv4 } from "uuid";

import { VisualizationType } from "@/visualization/fixtureVisualization";
import { assetCatalog } from "@/assetLibrary/catalog";
import { isMaterialPresetId } from "@/assetLibrary/materials";
import { completeParams, sizeOf } from "@/assetLibrary/params";
import type { ParamValues } from "@/assetLibrary/types";
import { deserializeAssets } from "./assets";
import {
    createDefaultCameraPose,
    createDefaultScene,
    createDefaultSettings,
    defaultShapeDimensions,
    MODEL_SCALE_MAX,
    MODEL_SCALE_MIN,
} from "./defaults";
import { composeLocalRotation, fromMatrix, MIN_SCALE, toMatrix } from "./transformMath";
import type { CameraPose, CameraPosition, SceneEditorSettings, SceneObject, SceneState, ShapeType, Vec3 } from "./types";

type Rec = Record<string, unknown>;

export interface SanitizeResult {
    scene: SceneState;
    problems: string[];
    /** `libraryAsset` objects whose asset is not in the catalog (shown as placeholders). */
    unknownAssets: number;
    /** Fixture visualizations whose model id is not in the catalog (shown with the generic body). */
    unknownModels: number;
}

interface SanitizeContext {
    problems: string[];
    unknownAssets: number;
    unknownModels: number;
    /** Spot visualizations saved by 001 (no `modelId`), which need the re-orientation of research R3 (T042). */
    legacySpotIds: string[];
}

function isRec(v: unknown): v is Rec {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function vec3(v: unknown, fallback: Vec3): Vec3 {
    if (!Array.isArray(v)) {
        return [...fallback];
    }
    return [num(v[0], fallback[0]), num(v[1], fallback[1]), num(v[2], fallback[2])];
}

function normalizeAngle(deg: number): number {
    let a = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (a === -180) {
        a = 180;
    }
    return a;
}

function sanitizeCameraPose(raw: unknown, fallback: CameraPose): CameraPose {
    const r = isRec(raw) ? raw : {};
    const position = vec3(r.position, fallback.position);
    let target = vec3(r.target, fallback.target);
    if (position[0] === target[0] && position[1] === target[1] && position[2] === target[2]) {
        target = [...fallback.target];
        if (position[0] === target[0] && position[1] === target[1] && position[2] === target[2]) {
            target = [position[0], position[1], position[2] - 1];
        }
    }
    return { position, target, fov: Math.min(120, Math.max(10, num(r.fov, fallback.fov))) };
}

function sanitizeSettings(raw: unknown): SceneEditorSettings {
    const d = createDefaultSettings();
    const r = isRec(raw) ? raw : {};
    const positive = (v: unknown, fb: number) => {
        const n = num(v, fb);
        return n > 0 ? n : fb;
    };
    return {
        showGrid: typeof r.showGrid === "boolean" ? r.showGrid : d.showGrid,
        showAxes: typeof r.showAxes === "boolean" ? r.showAxes : d.showAxes,
        showLabels: typeof r.showLabels === "boolean" ? r.showLabels : d.showLabels,
        snapEnabled: typeof r.snapEnabled === "boolean" ? r.snapEnabled : d.snapEnabled,
        translationSnap: positive(r.translationSnap, d.translationSnap),
        rotationSnap: positive(r.rotationSnap, d.rotationSnap),
        scaleSnap: positive(r.scaleSnap, d.scaleSnap),
        transformSpace: r.transformSpace === "local" ? "local" : "world",
    };
}

function clampDim(v: unknown, fallback: number): number {
    return Math.max(0.01, num(v, fallback));
}

function sanitizeColor(v: unknown, fallback: string): string {
    return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function sanitizeNullableColor(v: unknown): string | null {
    return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

/** Load rule 1 (data-model.md): known assets are fixed, unknown ones keep their values if the types fit. */
function sanitizeLibraryAsset(obj: Rec, raw: Rec, ctx: SanitizeContext) {
    if (typeof raw.assetId !== "string") {
        ctx.problems.push(`Library asset "${String(obj.name)}" is invalid and was converted to a group`);
        obj.kind = "group";
        for (const key of ["assetId", "params", "material", "color", "variant", "size"]) {
            Reflect.deleteProperty(obj, key);
        }
        return;
    }
    const def = assetCatalog.get(raw.assetId);
    obj.assetId = raw.assetId;
    if (def) {
        obj.params = completeParams(def, isRec(raw.params) ? (raw.params as Partial<ParamValues>) : {});
        obj.material = isMaterialPresetId(raw.material) && def.supportsMaterial ? raw.material : null;
        obj.color = sanitizeNullableColor(raw.color);
        obj.variant = typeof raw.variant === "string" && def.variants?.some((v) => v.id === raw.variant) ? raw.variant : null;
    } else {
        ctx.unknownAssets++;
        obj.params = isRec(raw.params) ? raw.params : {};
        obj.material = typeof raw.material === "string" ? raw.material : null;
        obj.color = typeof raw.color === "string" ? raw.color : null;
        obj.variant = typeof raw.variant === "string" ? raw.variant : null;
    }
    if (def?.source.type === "parametric") {
        // the parameters define the size; a stored scale would distort the element (T078)
        obj.scale = [1, 1, 1];
        obj.size = sizeOf(def, obj.params as ParamValues);
        return;
    }
    const fallbackSize = def ? sizeOf(def, obj.params as ParamValues) : ([0.5, 0.5, 0.5] as Vec3);
    obj.size = vec3(raw.size, fallbackSize).map((v) => Math.max(0.01, v)) as Vec3;
}

/** Load rule 2 (data-model.md): `modelId` and `modelScale` of fixture visualizations. */
function sanitizeFixtureModel(obj: Rec, raw: Rec, ctx: SanitizeContext) {
    const type = obj.visualizationType as VisualizationType;
    obj.modelScale = Math.min(MODEL_SCALE_MAX, Math.max(MODEL_SCALE_MIN, num(raw.modelScale, 1)));
    if (typeof raw.modelId !== "string") {
        // saved by 001
        obj.modelId = assetCatalog.defaultModelFor(type).id;
        if (type === VisualizationType.SPOT) {
            ctx.legacySpotIds.push(String(obj.id));
        }
        return;
    }
    const def = assetCatalog.get(raw.modelId);
    if (!def) {
        // a newer file: keep the id, the generic body is shown
        ctx.unknownModels++;
        obj.modelId = raw.modelId;
    } else if (def.category !== "fixtures" || !def.fixture.visualizationTypes.includes(type)) {
        obj.modelId = assetCatalog.defaultModelFor(type).id;
    } else {
        obj.modelId = raw.modelId;
    }
}

/**
 * Research R3 / T042: 001 spots emitted along local −Y, models now emit along local +Y. A spot saved by 001 is
 * turned by 180° about its local X axis so the beam keeps pointing where it did. Its children get the inverse turn
 * (Rx(180°) is its own inverse), so they keep their world transform. Silent conversion, no problem message.
 */
function reorientLegacySpots(objects: Record<string, SceneObject>, spotIds: string[]) {
    const flip = new Matrix4().makeRotationX(Math.PI);
    for (const id of spotIds) {
        const spot = objects[id];
        if (!spot) {
            continue;
        }
        spot.rotation = composeLocalRotation(spot.rotation, "x", 180);
        for (const childId of spot.children) {
            const child = objects[childId];
            if (child) {
                const t = fromMatrix(flip.clone().multiply(toMatrix(child)));
                child.position = t.position;
                child.rotation = t.rotation;
                child.scale = t.scale;
            }
        }
    }
}

/** Sanitizes fields common to all kinds, keeps every other property as it is. */
function sanitizeObject(id: string, raw: Rec, ctx: SanitizeContext): SceneObject {
    const problems = ctx.problems;
    const obj: Rec = { ...raw };
    obj.id = id;
    obj.name = typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name : "Object";
    obj.kind = typeof raw.kind === "string" ? raw.kind : "group";
    obj.parentId = typeof raw.parentId === "string" ? raw.parentId : null;
    obj.children = [];
    obj.position = vec3(raw.position, [0, 0, 0]);
    const rot = vec3(raw.rotation, [0, 0, 0]);
    obj.rotation = rot.map(normalizeAngle) as Vec3;
    obj.scale = vec3(raw.scale, [1, 1, 1]).map((s) => Math.max(MIN_SCALE, s)) as Vec3;
    obj.visible = typeof raw.visible === "boolean" ? raw.visible : true;
    obj.locked = typeof raw.locked === "boolean" ? raw.locked : false;

    if (obj.kind === "shape") {
        const shape: ShapeType = ["box", "cylinder", "plane", "sphere"].includes(raw.shape as string) ? (raw.shape as ShapeType) : "box";
        const defaults = defaultShapeDimensions(shape).dimensions as Record<string, number>;
        const dims = isRec(raw.dimensions) ? raw.dimensions : {};
        const out: Record<string, number> = {};
        for (const key of Object.keys(defaults)) {
            out[key] = clampDim(dims[key], defaults[key]);
        }
        obj.shape = shape;
        obj.dimensions = out;
        obj.color = sanitizeColor(raw.color, "#9e9e9e");
        obj.material = isMaterialPresetId(raw.material) ? raw.material : null;
    } else if (obj.kind === "fixtureVisualization") {
        obj.fixtureId = typeof raw.fixtureId === "string" ? raw.fixtureId : null;
        if (!Object.values(VisualizationType).includes(raw.visualizationType as VisualizationType) || !isRec(raw.config)) {
            problems.push(`Visualization "${String(obj.name)}" is invalid and was converted to a group`);
            obj.kind = "group";
            delete obj.fixtureId;
            delete obj.visualizationType;
            delete obj.config;
            delete obj.modelId;
            delete obj.modelScale;
        } else {
            sanitizeFixtureModel(obj, raw, ctx);
        }
    } else if (obj.kind === "libraryAsset") {
        sanitizeLibraryAsset(obj, raw, ctx);
    } else if (obj.kind === "importedModel") {
        obj.assetId = typeof raw.assetId === "string" ? raw.assetId : "";
        obj.originalScale = vec3(raw.originalScale, [1, 1, 1]).map((s) => Math.max(MIN_SCALE, s)) as Vec3;
    }
    return obj as unknown as SceneObject;
}

/** Tolerant load (data-model.md, validation rule 7). Never throws. */
export function sanitizeScene(raw: unknown): SanitizeResult {
    const ctx: SanitizeContext = { problems: [], unknownAssets: 0, unknownModels: 0, legacySpotIds: [] };
    try {
        const scene = sanitizeSceneUnsafe(raw, ctx);
        return { scene, problems: ctx.problems, unknownAssets: ctx.unknownAssets, unknownModels: ctx.unknownModels };
    } catch (err) {
        ctx.problems.push(`Scene could not be read: ${err instanceof Error ? err.message : String(err)}`);
        return { scene: createDefaultScene(), problems: ctx.problems, unknownAssets: 0, unknownModels: 0 };
    }
}

function sanitizeSceneUnsafe(raw: unknown, ctx: SanitizeContext): SceneState {
    const problems = ctx.problems;
    const r = isRec(raw) ? raw : {};
    const { assets, problems: assetProblems } = deserializeAssets(r.assets);
    problems.push(...assetProblems);

    const objects: Record<string, SceneObject> = {};
    const rawObjects = isRec(r.objects) ? r.objects : {};
    for (const [key, value] of Object.entries(rawObjects)) {
        if (!isRec(value)) {
            problems.push(`Object ${key} is invalid and was skipped`);
            continue;
        }
        const id = typeof value.id === "string" && value.id.length > 0 ? value.id : key;
        objects[id] = sanitizeObject(id, value, ctx);
    }

    // missing parents -> root objects, cycles broken
    for (const obj of Object.values(objects)) {
        if (obj.parentId !== null && !objects[obj.parentId]) {
            problems.push(`"${obj.name}" had a missing parent and was moved to the top level`);
            obj.parentId = null;
        }
    }
    for (const obj of Object.values(objects)) {
        const seen = new Set<string>([obj.id]);
        let current = obj.parentId;
        while (current) {
            if (seen.has(current)) {
                problems.push(`"${obj.name}" was part of a cycle and was moved to the top level`);
                obj.parentId = null;
                break;
            }
            seen.add(current);
            current = objects[current].parentId;
        }
    }

    // rebuild children / rootOrder, keeping the stored order where possible
    const storedRootOrder = Array.isArray(r.rootOrder) ? (r.rootOrder as unknown[]).filter((v): v is string => typeof v === "string") : [];
    const rootOrder: string[] = [];
    for (const id of storedRootOrder) {
        if (objects[id] && objects[id].parentId === null && !rootOrder.includes(id)) {
            rootOrder.push(id);
        }
    }
    for (const [key, value] of Object.entries(rawObjects)) {
        const id = isRec(value) && typeof value.id === "string" && value.id.length > 0 ? value.id : key;
        const obj = objects[id];
        if (!obj) continue;
        if (obj.parentId === null) {
            if (!rootOrder.includes(id)) rootOrder.push(id);
        }
    }
    for (const [key, value] of Object.entries(rawObjects)) {
        if (!isRec(value) || !Array.isArray(value.children)) continue;
        const id = typeof value.id === "string" && value.id.length > 0 ? value.id : key;
        const obj = objects[id];
        for (const childId of value.children as unknown[]) {
            if (typeof childId === "string" && objects[childId]?.parentId === id && !obj.children.includes(childId)) {
                obj.children.push(childId);
            }
        }
    }
    for (const obj of Object.values(objects)) {
        if (obj.parentId !== null) {
            const parent = objects[obj.parentId];
            if (!parent.children.includes(obj.id)) {
                parent.children.push(obj.id);
            }
        }
    }

    reorientLegacySpots(objects, ctx.legacySpotIds);

    // imported models need their asset
    for (const obj of Object.values(objects)) {
        if (obj.kind === "importedModel" && !assets[obj.assetId]) {
            problems.push(`Model "${obj.name}" is missing its data`);
        }
    }

    // cameras
    const cameras: CameraPosition[] = [];
    if (Array.isArray(r.cameras)) {
        for (const c of r.cameras) {
            if (!isRec(c)) continue;
            const pose = sanitizeCameraPose(c, createDefaultCameraPose());
            cameras.push({
                id: typeof c.id === "string" && c.id.length > 0 ? c.id : uuidv4(),
                name: typeof c.name === "string" && c.name.trim().length > 0 ? c.name : "Camera",
                ...pose,
                isShowDefault: c.isShowDefault === true,
            });
        }
    }
    let defaultSeen = false;
    for (const c of cameras) {
        if (c.isShowDefault) {
            if (defaultSeen) c.isShowDefault = false;
            defaultSeen = true;
        }
    }

    const scene: SceneState = {
        formatVersion: 1,
        objects,
        rootOrder,
        cameras,
        editorCamera: sanitizeCameraPose(r.editorCamera, createDefaultCameraPose()),
        settings: sanitizeSettings(r.settings),
        assets,
    };
    return scene;
}
