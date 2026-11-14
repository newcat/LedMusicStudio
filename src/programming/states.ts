/**
 * Saved states of the new library items (feature 004, data-model §6–§8, contracts/project-state-delta.ts).
 * Type-only module plus defaults/sanitizers: no Vue/Pinia imports.
 */

import { ATTRIBUTE_KEYS, isNumericContinuous, sanitizeAttributeValues, validateAttributeValue } from "./attributes";
import type { AttributeKey, AttributeValue, AttributeValues, Rgb } from "./attributes";

// ---------------------------------------------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------------------------------------------

export type LookValue =
    | { kind: "single"; value: AttributeValue }
    | { kind: "fan"; from: AttributeValue; to: AttributeValue; mirror: boolean }
    | { kind: "preset"; presetId: string }
    /** only under key "pan"; sets pan and tilt */
    | { kind: "aim"; aimTargetId: string };

export interface LookState {
    values: Partial<Record<AttributeKey, LookValue>>;
    /** 0..1, default 0 */
    fanTiming: number;
    /** Only written when a referenced preset is deleted (bake, R10). default {} */
    perFixture: Record<string, AttributeValues>;
}

export function defaultLookState(): LookState {
    return { values: {}, fanTiming: 0, perFixture: {} };
}

/** Fan values are only allowed for continuous attributes (data-model §6). */
export function canFan(key: AttributeKey): boolean {
    return key === "color" || isNumericContinuous(key);
}

function sanitizeLookValue(key: AttributeKey, raw: unknown): LookValue | null {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }
    const v = raw as Record<string, unknown>;
    switch (v.kind) {
        case "single": {
            const value = validateAttributeValue(key, v.value);
            return value === null ? null : { kind: "single", value };
        }
        case "fan": {
            if (!canFan(key)) {
                return null;
            }
            const from = validateAttributeValue(key, v.from);
            const to = validateAttributeValue(key, v.to);
            return from === null || to === null ? null : { kind: "fan", from, to, mirror: v.mirror === true };
        }
        case "preset":
            return typeof v.presetId === "string" ? { kind: "preset", presetId: v.presetId } : null;
        case "aim":
            return key === "pan" && typeof v.aimTargetId === "string" ? { kind: "aim", aimTargetId: v.aimTargetId } : null;
    }
    return null;
}

export function sanitizeLookState(raw: unknown): LookState {
    const state = defaultLookState();
    if (typeof raw !== "object" || raw === null) {
        return state;
    }
    const r = raw as Record<string, unknown>;
    const values = (typeof r.values === "object" && r.values !== null ? r.values : {}) as Record<string, unknown>;
    for (const key of ATTRIBUTE_KEYS) {
        const v = sanitizeLookValue(key, values[key]);
        if (v) {
            state.values[key] = v;
        }
    }
    // an aim value sets tilt too
    if (state.values.pan?.kind === "aim") {
        delete state.values.tilt;
    }
    const fanTiming = typeof r.fanTiming === "number" && Number.isFinite(r.fanTiming) ? r.fanTiming : 0;
    state.fanTiming = Math.min(1, Math.max(0, fanTiming));
    if (typeof r.perFixture === "object" && r.perFixture !== null) {
        for (const [fixtureId, values] of Object.entries(r.perFixture as Record<string, unknown>)) {
            const sanitized = sanitizeAttributeValues(values);
            if (Object.keys(sanitized).length > 0) {
                state.perFixture[fixtureId] = sanitized;
            }
        }
    }
    return state;
}

// ---------------------------------------------------------------------------------------------------------------
// Effect
// ---------------------------------------------------------------------------------------------------------------

export type EffectAttribute = "dimmer" | "pan" | "tilt" | "panTilt" | "zoom" | "focus" | "color";
export type EffectShape = "sine" | "triangle" | "sawUp" | "sawDown" | "square" | "circle" | "figure8";

export const EFFECT_ATTRIBUTES: Array<{ value: EffectAttribute; label: string }> = [
    { value: "dimmer", label: "Dimmer" },
    { value: "pan", label: "Pan" },
    { value: "tilt", label: "Tilt" },
    { value: "panTilt", label: "Pan + Tilt" },
    { value: "zoom", label: "Zoom" },
    { value: "focus", label: "Focus" },
    { value: "color", label: "Color" },
];

export const EFFECT_SHAPES: Array<{ value: EffectShape; label: string; panTiltOnly?: boolean }> = [
    { value: "sine", label: "Sine" },
    { value: "triangle", label: "Triangle" },
    { value: "sawUp", label: "Saw up" },
    { value: "sawDown", label: "Saw down" },
    { value: "square", label: "Square" },
    { value: "circle", label: "Circle", panTiltOnly: true },
    { value: "figure8", label: "Figure 8", panTiltOnly: true },
];

export interface EffectState {
    attribute: EffectAttribute;
    shape: EffectShape;
    mode: "relative" | "absolute";
    /** panTilt: [panDeg, tiltDeg]; dimmer/zoom/focus: 0..1 swing; pan/tilt: degrees */
    size: number | [number, number];
    /** absolute mode only */
    base: number | [number, number];
    /** color only */
    colors: [Rgb, Rgb];
    /** > 0, beats per cycle, default 1 */
    rateBeats: number;
    /** degrees 0..720, default 360 */
    spread: number;
    /** duty cycle 0.01..1, default 1: the shape runs in this fraction of each cycle, the rest stays at its minimum */
    width: number;
    /** integers ≥ 1, default 1 */
    wings: number;
    blocks: number;
    interleave: number;
    direction: "forward" | "backward";
}

export function isPairAttribute(attribute: EffectAttribute): boolean {
    return attribute === "panTilt";
}

/** Size and base defaults per attribute. */
export function effectSizeDefaults(attribute: EffectAttribute): { size: number | [number, number]; base: number | [number, number] } {
    switch (attribute) {
        case "panTilt":
            return { size: [20, 20], base: [0, 0] };
        case "pan":
        case "tilt":
            return { size: 20, base: 0 };
        default:
            return { size: 0.5, base: 0.5 };
    }
}

export function defaultEffectState(): EffectState {
    return {
        attribute: "dimmer",
        shape: "sine",
        mode: "relative",
        ...effectSizeDefaults("dimmer"),
        colors: [
            [1, 0, 0],
            [0, 0, 1],
        ],
        rateBeats: 1,
        spread: 360,
        width: 1,
        wings: 1,
        blocks: 1,
        interleave: 1,
        direction: "forward",
    };
}

function finite(v: unknown, fallback: number): number {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function intAtLeast1(v: unknown): number {
    return Math.max(1, Math.round(finite(v, 1)));
}

function sizeValue(attribute: EffectAttribute, raw: unknown, fallback: number | [number, number]): number | [number, number] {
    if (isPairAttribute(attribute)) {
        if (Array.isArray(raw) && raw.length === 2) {
            const f = fallback as [number, number];
            return [finite(raw[0], f[0]), finite(raw[1], f[1])];
        }
        return typeof raw === "number" && Number.isFinite(raw) ? [raw, raw] : fallback;
    }
    if (Array.isArray(raw)) {
        return finite(raw[0], fallback as number);
    }
    return finite(raw, fallback as number);
}

/** Validation (data-model §7): rateBeats > 0, spread 0..720, width 0.01..1, integers ≥ 1, circle/figure8 only with panTilt, color forces absolute. */
export function sanitizeEffectState(raw: unknown): EffectState {
    const d = defaultEffectState();
    if (typeof raw !== "object" || raw === null) {
        return d;
    }
    const r = raw as Record<string, unknown>;
    const attribute = EFFECT_ATTRIBUTES.some((a) => a.value === r.attribute) ? (r.attribute as EffectAttribute) : d.attribute;
    let shape = EFFECT_SHAPES.some((s) => s.value === r.shape) ? (r.shape as EffectShape) : d.shape;
    if ((shape === "circle" || shape === "figure8") && attribute !== "panTilt") {
        shape = "sine";
    }
    const sizeDefaults = effectSizeDefaults(attribute);
    const color = (v: unknown, fallback: Rgb): Rgb => (validateAttributeValue("color", v) as Rgb | null) ?? fallback;
    const colors = Array.isArray(r.colors) ? r.colors : [];
    const rateBeats = finite(r.rateBeats, 1);
    return {
        attribute,
        shape,
        mode: attribute === "color" ? "absolute" : r.mode === "absolute" ? "absolute" : "relative",
        size: sizeValue(attribute, r.size, sizeDefaults.size),
        base: sizeValue(attribute, r.base, sizeDefaults.base),
        colors: [color(colors[0], d.colors[0]), color(colors[1], d.colors[1])],
        rateBeats: rateBeats > 0 ? rateBeats : 1,
        spread: Math.min(720, Math.max(0, finite(r.spread, 360))),
        width: Math.min(1, Math.max(0.01, finite(r.width, 1))),
        wings: intAtLeast1(r.wings),
        blocks: intAtLeast1(r.blocks),
        interleave: intAtLeast1(r.interleave),
        direction: r.direction === "backward" ? "backward" : "forward",
    };
}

// ---------------------------------------------------------------------------------------------------------------
// Preset
// ---------------------------------------------------------------------------------------------------------------

export type PresetKind = "position" | "color" | "beam";

/** Allowed keys per kind (research R10). */
export const PRESET_KEYS: Record<PresetKind, AttributeKey[]> = {
    position: ["pan", "tilt"],
    color: ["color", "colorWheel", "colorTemperature", "colorMacro"],
    beam: ["goboWheel", "goboRotation", "prism", "prismRotation", "zoom", "focus", "shutter"],
};

export const PRESET_KIND_LABELS: Record<PresetKind, string> = {
    position: "Position",
    color: "Color",
    beam: "Beam",
};

export interface PresetState {
    presetKind: PresetKind;
    common: AttributeValues;
    perFixture: Record<string, AttributeValues>;
    /** position only; overrides pan/tilt values when set. default null */
    aimTargetId: string | null;
}

export function presetKindOf(key: AttributeKey): PresetKind | null {
    for (const kind of Object.keys(PRESET_KEYS) as PresetKind[]) {
        if (PRESET_KEYS[kind].includes(key)) {
            return kind;
        }
    }
    return null;
}

export function defaultPresetState(kind: PresetKind = "position"): PresetState {
    return { presetKind: kind, common: {}, perFixture: {}, aimTargetId: null };
}

function onlyAllowed(kind: PresetKind, values: AttributeValues): AttributeValues {
    const result: AttributeValues = {};
    for (const key of PRESET_KEYS[kind]) {
        if (values[key] !== undefined) {
            (result as Record<AttributeKey, AttributeValue>)[key] = values[key] as AttributeValue;
        }
    }
    return result;
}

export function sanitizePresetState(raw: unknown): PresetState {
    if (typeof raw !== "object" || raw === null) {
        return defaultPresetState();
    }
    const r = raw as Record<string, unknown>;
    const kind: PresetKind = r.presetKind === "color" || r.presetKind === "beam" ? r.presetKind : "position";
    const perFixture: Record<string, AttributeValues> = {};
    if (typeof r.perFixture === "object" && r.perFixture !== null) {
        for (const [fixtureId, values] of Object.entries(r.perFixture as Record<string, unknown>)) {
            perFixture[fixtureId] = onlyAllowed(kind, sanitizeAttributeValues(values));
        }
    }
    return {
        presetKind: kind,
        common: onlyAllowed(kind, sanitizeAttributeValues(r.common)),
        perFixture,
        aimTargetId: kind === "position" && typeof r.aimTargetId === "string" && r.aimTargetId ? r.aimTargetId : null,
    };
}

/** Value of a preset for a fixture: per-fixture value, else common value, else undefined (US7.3). */
export function presetValue(preset: PresetState, key: AttributeKey, fixtureId: string): AttributeValue | undefined {
    return preset.perFixture[fixtureId]?.[key] ?? preset.common[key];
}
