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
import { DEFAULT_ENVIRONMENT } from "@/visualization/environment";
import { emptyMapping, type CapabilityChannel, type CapabilityKey, type CapabilityMapping } from "@/visualization/capabilities/types";
import { sanitizeMapping } from "@/visualization/capabilities/sanitizeMapping";
import { defaultMovement } from "@/visualization/fixtureVisualizations/beam/types";
import { defaultEffectOptions, effectKindOf } from "@/visualization/fixtureVisualizations/effects/types";
import { defaultStripPath } from "@/visualization/fixtureVisualizations/ledStrip/types";
import { beamSoftnessFor, genericLightAngleFor, genericSurfaceLightFor } from "@/visualization/fixtureVisualizations/modelDefaults";
import type {
    AmbientPreset,
    AmbientSetting,
    BeamVisualizationConfig,
    FixtureVisualizationObject,
    GenericVisualizationConfig,
    LedStripVisualizationConfig,
    MovementSettings,
    StripPath,
    StripPathPoint,
    CameraPose,
    CameraPosition,
    SceneEditorSettings,
    SceneEnvironment,
    SceneObject,
    SceneState,
    ShapeType,
    Vec3,
} from "./types";

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

function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

const AMBIENT_PRESETS: readonly AmbientPreset[] = ["dark", "house", "daylight"];

function sanitizeAmbient(raw: unknown, fallback: AmbientSetting): AmbientSetting {
    const r = isRec(raw) ? raw : {};
    return {
        preset: AMBIENT_PRESETS.includes(r.preset as AmbientPreset) ? (r.preset as AmbientPreset) : fallback.preset,
        brightness: clamp(num(r.brightness, fallback.brightness), 0, 2),
    };
}

/** Load rule 1 (feature 003 data-model §8): a missing environment gets the defaults; values are clamped. */
export function sanitizeEnvironment(raw: unknown): SceneEnvironment {
    const d = DEFAULT_ENVIRONMENT;
    const r = isRec(raw) ? raw : {};
    const ambient = isRec(r.ambient) ? r.ambient : {};
    return {
        haze: clamp(num(r.haze, d.haze), 0, 1),
        hazerCoupling: typeof r.hazerCoupling === "boolean" ? r.hazerCoupling : false,
        ambient: {
            editor: sanitizeAmbient(ambient.editor, d.ambient.editor),
            show: sanitizeAmbient(ambient.show, d.ambient.show),
        },
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

// ---------------------------------------------------------------------------------------------------------------
// Fixture visualization configs (feature 003, data-model §2 and §8 rules 2–6)
// ---------------------------------------------------------------------------------------------------------------

/** Tracks whether a stored value had to be replaced or clamped. */
class RepairTracker {
    public repaired = false;

    /** A finite number clamped to min…max; missing or invalid values get `fallback`. */
    public clamp(value: unknown, fallback: number, min: number, max: number): number {
        const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
        const result = clamp(n, min, max);
        if (result !== value) {
            this.repaired = true;
        }
        return result;
    }

    public flag(repaired: boolean) {
        this.repaired ||= repaired;
    }
}

function channelIndex(v: unknown): number {
    return Number.isInteger(v) && (v as number) >= 0 ? (v as number) : -1;
}

function linearEntry(channel: number, start: number, end: number, defaultValue: number): CapabilityChannel {
    return { channel, fine: -1, segments: [{ kind: "linear", from: 0, to: 255, start, end }], defaultValue, source: "manual" };
}

/** Old `{ channel, defaultValue, min, max }` (rules 2 and 4): linear 0…255 → min…max. */
function convertOldRange(raw: unknown, fallback: { min: number; max: number; defaultValue: number }): CapabilityChannel {
    const r = isRec(raw) ? raw : {};
    return linearEntry(channelIndex(r.channel), num(r.min, fallback.min), num(r.max, fallback.max), num(r.defaultValue, fallback.defaultValue));
}

/**
 * Old color channel: a DMX index (raw value / 255) or, as written by the old settings UI, a range object whose
 * min…max was divided by 255 too. Unmapped colors get no entry, so "no color mapped" still means white (FR-003).
 */
function convertOldColor(raw: unknown): CapabilityChannel | null {
    if (isRec(raw)) {
        const channel = channelIndex(raw.channel);
        return channel >= 0 ? linearEntry(channel, num(raw.min, 0) / 255, num(raw.max, 255) / 255, num(raw.defaultValue, 0) / 255) : null;
    }
    const channel = channelIndex(raw);
    return channel >= 0 ? linearEntry(channel, 0, 1, 0) : null;
}

function addColors(mapping: CapabilityMapping, colors: Partial<Record<CapabilityKey, unknown>>) {
    for (const [key, raw] of Object.entries(colors) as Array<[CapabilityKey, unknown]>) {
        const entry = convertOldColor(raw);
        if (entry) {
            mapping.channels[key] = entry;
        }
    }
}

/** Rule 2: old Moving Head `channelMapping` (pan/tilt/beamAngle ranges, red/green/blue). */
function convertOldMovingHead(channelMapping: Rec): { mapping: CapabilityMapping; defaultBeamAngle: number } {
    const mapping = emptyMapping();
    mapping.channels.pan = convertOldRange(channelMapping.pan, { min: -180, max: 180, defaultValue: 0 });
    mapping.channels.tilt = convertOldRange(channelMapping.tilt, { min: -120, max: 120, defaultValue: 0 });
    const zoom = convertOldRange(channelMapping.beamAngle, { min: 1, max: 45, defaultValue: 10 });
    mapping.channels.zoom = zoom;
    addColors(mapping, { red: channelMapping.red, green: channelMapping.green, blue: channelMapping.blue });
    return { mapping, defaultBeamAngle: zoom.defaultValue };
}

/** Rule 3: old Spot `colorChannels: [r, g, b, w]`. */
function convertOldSpot(colorChannels: unknown[]): CapabilityMapping {
    const mapping = emptyMapping();
    addColors(mapping, { red: colorChannels[0], green: colorChannels[1], blue: colorChannels[2], white: colorChannels[3] });
    return mapping;
}

function sanitizeMovement(raw: unknown, fix: RepairTracker): MovementSettings {
    const d = defaultMovement();
    if (!isRec(raw)) {
        fix.flag(true);
        return d;
    }
    if (raw.mode !== "realistic" && raw.mode !== "instant") {
        fix.flag(true);
    }
    return {
        mode: raw.mode === "instant" ? "instant" : d.mode,
        panSpeed: fix.clamp(raw.panSpeed, d.panSpeed, 30, 1500),
        tiltSpeed: fix.clamp(raw.tiltSpeed, d.tiltSpeed, 30, 1500),
    };
}

/** Spot / Moving Head (rules 2, 3 and 6). */
function sanitizeBeamConfig(type: VisualizationType, c: Rec, modelId: string, fix: RepairTracker): BeamVisualizationConfig {
    let converted: { mapping: CapabilityMapping; defaultBeamAngle: number } | null = null;
    if (!isRec(c.mapping)) {
        if (isRec(c.channelMapping)) {
            converted = convertOldMovingHead(c.channelMapping);
        } else if (Array.isArray(c.colorChannels)) {
            converted = { mapping: convertOldSpot(c.colorChannels), defaultBeamAngle: 15 };
        }
    }
    if (converted) {
        // format conversion; only keys the type can't use are reported (e.g. pan/tilt of a moving head config on a spot)
        const result = sanitizeMapping(converted.mapping, type);
        fix.flag(result.repaired);
        return {
            mapping: result.mapping,
            movement: defaultMovement(),
            defaultBeamAngle: clamp(converted.defaultBeamAngle, 1, 120),
            softness: beamSoftnessFor(modelId),
            prismSpread: 6,
        };
    }
    const result = sanitizeMapping(c.mapping, type);
    fix.flag(result.repaired);
    return {
        mapping: result.mapping,
        movement: sanitizeMovement(c.movement, fix),
        defaultBeamAngle: fix.clamp(c.defaultBeamAngle, 15, 1, 120),
        softness: fix.clamp(c.softness, beamSoftnessFor(modelId), 0, 1),
        prismSpread: fix.clamp(c.prismSpread, 6, 1, 30),
    };
}

/** Generic Fixture (rules 4 and 6). */
function sanitizeGenericConfig(c: Rec, modelId: string, fix: RepairTracker): GenericVisualizationConfig {
    if (!isRec(c.mapping) && isRec(c.channelMapping)) {
        const old = c.channelMapping;
        const mapping = emptyMapping();
        mapping.channels.dimmer = convertOldRange(old.intensity, { min: 0, max: 1, defaultValue: 1 });
        addColors(mapping, { red: old.red, green: old.green, blue: old.blue, white: old.white });
        return { mapping, surfaceLight: genericSurfaceLightFor(modelId), lightAngle: genericLightAngleFor(modelId) };
    }
    const result = sanitizeMapping(c.mapping, VisualizationType.GENERIC);
    fix.flag(result.repaired);
    if (typeof c.surfaceLight !== "boolean") {
        fix.flag(true);
    }
    return {
        mapping: result.mapping,
        surfaceLight: typeof c.surfaceLight === "boolean" ? c.surfaceLight : genericSurfaceLightFor(modelId),
        lightAngle: fix.clamp(c.lightAngle, genericLightAngleFor(modelId), 10, 170),
    };
}

function isFiniteVec3(v: unknown): v is Vec3 {
    return Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((n) => typeof n === "number" && Number.isFinite(n));
}

/** Path rule: finite points, normalized normals (zero → +Y), at least 2 distinct points or the default path. */
function sanitizeStripPath(raw: unknown, fix: RepairTracker): StripPath {
    const path = normalizeStripPath(raw, fix);
    if (!path) {
        fix.flag(true);
        return defaultStripPath();
    }
    return path;
}

/**
 * Validates a strip path (data-model §3): points with non-finite coordinates are dropped, normals are normalized
 * (zero or invalid → +Y). Returns null when fewer than 2 distinct points remain. Used by the load rules and by the
 * `setStripPath` command.
 */
export function validateStripPath(raw: unknown): StripPath | null {
    return normalizeStripPath(raw, new RepairTracker());
}

function normalizeStripPath(raw: unknown, fix: RepairTracker): StripPath | null {
    if (!isRec(raw) || !Array.isArray(raw.points)) {
        return null;
    }
    const points: StripPathPoint[] = [];
    for (const p of raw.points) {
        if (!isRec(p) || !isFiniteVec3(p.position)) {
            fix.flag(true);
            continue;
        }
        let normal: Vec3 = [0, 1, 0];
        const len = isFiniteVec3(p.normal) ? Math.hypot(p.normal[0], p.normal[1], p.normal[2]) : 0;
        if (isFiniteVec3(p.normal) && len > 1e-9) {
            normal = [p.normal[0] / len, p.normal[1] / len, p.normal[2] / len];
            if (Math.abs(len - 1) > 1e-3) {
                fix.flag(true);
            }
        } else {
            fix.flag(true);
        }
        points.push({ position: [p.position[0], p.position[1], p.position[2]], normal });
    }
    const first = points[0]?.position;
    const distinct = !!first && points.some((p) => p.position[0] !== first[0] || p.position[1] !== first[1] || p.position[2] !== first[2]);
    if (!distinct) {
        return null;
    }
    if (raw.interpolation !== "linear" && raw.interpolation !== "curve") {
        fix.flag(true);
    }
    if (typeof raw.closed !== "boolean") {
        fix.flag(true);
    }
    return { points, interpolation: raw.interpolation === "curve" ? "curve" : "linear", closed: raw.closed === true };
}

/** Old strip intensities were a light scale with 0.001 as the normal value; the new field is 0…1 with 1 as default. */
const OLD_STRIP_INTENSITY = 0.001;

/** LED strip (rules 5 and 6). */
function sanitizeLedStripConfig(c: Rec, fix: RepairTracker): LedStripVisualizationConfig {
    if (!isRec(c.path) && isFiniteVec3(c.start) && isFiniteVec3(c.end)) {
        const pathFix = new RepairTracker();
        const path = sanitizeStripPath(
            {
                points: [
                    { position: c.start, normal: [0, 1, 0] },
                    { position: c.end, normal: [0, 1, 0] },
                ],
                interpolation: "linear",
                closed: false,
            },
            pathFix
        );
        // start === end has no length: that is a repair, not a plain conversion
        fix.flag(pathFix.repaired);
        return { intensity: clamp(num(c.intensity, OLD_STRIP_INTENSITY) / OLD_STRIP_INTENSITY, 0, 1), path, pixelSize: 0.6 };
    }
    return {
        intensity: fix.clamp(c.intensity, 1, 0, 1),
        path: sanitizeStripPath(c.path, fix),
        pixelSize: fix.clamp(c.pixelSize, 0.6, 0.2, 1),
    };
}

/**
 * Converts old configs (rules 2–5) and repairs new ones (rule 6). `repaired` is set when stored data had to be
 * dropped or fixed; plain format conversion does not set it.
 */
export function sanitizeVisualizationConfig(
    type: VisualizationType,
    raw: unknown,
    modelId: string
): { config: FixtureVisualizationObject["config"]; repaired: boolean } {
    const fix = new RepairTracker();
    const c = isRec(raw) ? raw : {};
    if (!isRec(raw)) {
        fix.flag(true);
    }
    let config: FixtureVisualizationObject["config"];
    switch (type) {
        case VisualizationType.MOVING_HEAD:
        case VisualizationType.SPOT:
            config = sanitizeBeamConfig(type, c, modelId, fix);
            break;
        case VisualizationType.GENERIC:
            config = sanitizeGenericConfig(c, modelId, fix);
            break;
        case VisualizationType.LED_STRIP:
            config = sanitizeLedStripConfig(c, fix);
            break;
        default: {
            // effect types (Laser, Flame, CO2 Jet, Cold Spark, Fog): the options must match the type, else defaults
            const result = sanitizeMapping(c.mapping, type);
            fix.flag(result.repaired);
            const kind = effectKindOf(type);
            const options = c.options as { kind?: unknown } | undefined;
            const optionsOk = kind !== null && options !== undefined && typeof options === "object" && options.kind === kind;
            if (kind !== null && !optionsOk) fix.flag(true);
            config = {
                mapping: result.mapping,
                options: optionsOk ? options : kind !== null ? defaultEffectOptions(kind) : undefined,
            } as unknown as FixtureVisualizationObject["config"];
        }
    }
    return { config, repaired: fix.repaired };
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
const AIM_TARGET_FIELDS = new Set(["id", "name", "kind", "parentId", "children", "position", "rotation", "scale", "visible", "locked"]);

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
            const { config, repaired } = sanitizeVisualizationConfig(obj.visualizationType as VisualizationType, raw.config, obj.modelId as string);
            obj.config = config;
            if (repaired) {
                problems.push(`Visualization "${String(obj.name)}" had invalid settings that were repaired`);
            }
        }
    } else if (obj.kind === "libraryAsset") {
        sanitizeLibraryAsset(obj, raw, ctx);
    } else if (obj.kind === "aimTarget") {
        // feature 004: base fields only; rotation and scale are not used
        return Object.fromEntries(Object.entries(obj).filter(([key]) => AIM_TARGET_FIELDS.has(key))) as unknown as SceneObject;
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
        environment: sanitizeEnvironment(r.environment),
        assets,
    };
    return scene;
}
