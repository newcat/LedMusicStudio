import { v4 as uuidv4 } from "uuid";

import { VisualizationType } from "@/visualization/fixtureVisualization";
import { deserializeAssets } from "./assets";
import { createDefaultCameraPose, createDefaultScene, createDefaultSettings, defaultShapeDimensions } from "./defaults";
import { MIN_SCALE } from "./transformMath";
import type { CameraPose, CameraPosition, SceneEditorSettings, SceneObject, SceneState, ShapeType, Vec3 } from "./types";

type Rec = Record<string, unknown>;

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

/** Sanitizes fields common to all kinds, keeps every other property as it is. */
function sanitizeObject(id: string, raw: Rec, problems: string[]): SceneObject {
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
    } else if (obj.kind === "fixtureVisualization") {
        obj.fixtureId = typeof raw.fixtureId === "string" ? raw.fixtureId : null;
        if (!Object.values(VisualizationType).includes(raw.visualizationType as VisualizationType) || !isRec(raw.config)) {
            problems.push(`Visualization "${String(obj.name)}" is invalid and was converted to a group`);
            obj.kind = "group";
            delete obj.fixtureId;
            delete obj.visualizationType;
            delete obj.config;
        }
    } else if (obj.kind === "importedModel") {
        obj.assetId = typeof raw.assetId === "string" ? raw.assetId : "";
        obj.originalScale = vec3(raw.originalScale, [1, 1, 1]).map((s) => Math.max(MIN_SCALE, s)) as Vec3;
    }
    return obj as unknown as SceneObject;
}

/** Tolerant load (data-model.md, validation rule 7). Never throws. */
export function sanitizeScene(raw: unknown): { scene: SceneState; problems: string[] } {
    const problems: string[] = [];
    try {
        return sanitizeSceneUnsafe(raw, problems);
    } catch (err) {
        problems.push(`Scene could not be read: ${err instanceof Error ? err.message : String(err)}`);
        return { scene: createDefaultScene(), problems };
    }
}

function sanitizeSceneUnsafe(raw: unknown, problems: string[]): { scene: SceneState; problems: string[] } {
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
        objects[id] = sanitizeObject(id, value, problems);
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
    return { scene, problems };
}
