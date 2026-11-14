/**
 * Attribute model (feature 004, research R1, data-model §1, contracts/attributes.ts).
 * Pure module: no Vue/Pinia imports.
 */

export type AttributeKey =
    | "dimmer"
    | "shutter"
    | "pan"
    | "tilt"
    | "panTiltSpeed"
    | "color"
    | "colorTemperature"
    | "colorWheel"
    | "colorMacro"
    | "goboWheel"
    | "goboRotation"
    | "prism"
    | "prismRotation"
    | "zoom"
    | "focus";

/** sRGB, each 0..1. */
export type Rgb = [number, number, number];

export interface ShutterValue {
    mode: "open" | "closed" | "strobe";
    /** Hz, only used for "strobe". */
    rate: number;
}

export interface AttributeValueMap {
    dimmer: number;
    shutter: ShutterValue;
    pan: number;
    tilt: number;
    panTiltSpeed: number;
    color: Rgb;
    colorTemperature: number;
    colorWheel: number;
    colorMacro: number;
    goboWheel: number;
    goboRotation: number;
    prism: number;
    prismRotation: number;
    zoom: number;
    focus: number;
}

export type AttributeValue = AttributeValueMap[AttributeKey];
export type AttributeValues = Partial<AttributeValueMap>;

export type AttributeKind = "continuous" | "discrete";

export interface AttributeInfo {
    key: AttributeKey;
    label: string;
    kind: AttributeKind;
    /** Display unit: "%", "°", "rps", "K", "Hz", "slot", "rgb". */
    unit: string;
    /** Capability keys (feature 003) whose mapping entries this attribute writes. */
    capabilityKeys: string[];
}

/** UI order (contracts/programming-ui.md). */
export const ATTRIBUTE_KEYS: readonly AttributeKey[] = [
    "dimmer",
    "shutter",
    "pan",
    "tilt",
    "panTiltSpeed",
    "color",
    "colorTemperature",
    "colorWheel",
    "colorMacro",
    "goboWheel",
    "goboRotation",
    "prism",
    "prismRotation",
    "zoom",
    "focus",
];

function info(key: AttributeKey, label: string, kind: AttributeKind, unit: string, capabilityKeys: string[]): AttributeInfo {
    return { key, label, kind, unit, capabilityKeys };
}

export const ATTRIBUTES: Record<AttributeKey, AttributeInfo> = {
    dimmer: info("dimmer", "Dimmer", "continuous", "%", ["dimmer"]),
    shutter: info("shutter", "Shutter", "discrete", "Hz", ["shutter"]),
    pan: info("pan", "Pan", "continuous", "°", ["pan"]),
    tilt: info("tilt", "Tilt", "continuous", "°", ["tilt"]),
    panTiltSpeed: info("panTiltSpeed", "Pan/Tilt Speed", "continuous", "%", ["panTiltSpeed"]),
    color: info("color", "Color", "continuous", "rgb", [
        "red",
        "green",
        "blue",
        "white",
        "amber",
        "uv",
        "lime",
        "indigo",
        "warmWhite",
        "coldWhite",
        "cyan",
        "magenta",
        "yellow",
        "colorWheel",
    ]),
    colorTemperature: info("colorTemperature", "Color Temperature", "continuous", "K", ["colorTemperature"]),
    colorWheel: info("colorWheel", "Color Wheel", "discrete", "slot", ["colorWheel"]),
    colorMacro: info("colorMacro", "Color Macro", "discrete", "slot", ["colorMacro"]),
    goboWheel: info("goboWheel", "Gobo Wheel", "discrete", "slot", ["goboWheel"]),
    goboRotation: info("goboRotation", "Gobo Rotation", "continuous", "rps", ["goboRotation"]),
    prism: info("prism", "Prism", "discrete", "slot", ["prism"]),
    prismRotation: info("prismRotation", "Prism Rotation", "continuous", "rps", ["prismRotation"]),
    zoom: info("zoom", "Zoom", "continuous", "%", ["zoom"]),
    focus: info("focus", "Focus", "continuous", "%", ["focus"]),
};

export type SlotAttributeKey = "colorWheel" | "goboWheel" | "prism" | "colorMacro";

export function isSlotAttribute(key: AttributeKey): key is SlotAttributeKey {
    return key === "colorWheel" || key === "goboWheel" || key === "prism" || key === "colorMacro";
}

export function isDiscrete(key: AttributeKey): boolean {
    return ATTRIBUTES[key].kind === "discrete";
}

/** Continuous attributes with a single number (everything continuous except color). */
export type NumericAttributeKey = Exclude<AttributeKey, "shutter" | "color" | SlotAttributeKey>;

export function isNumericContinuous(key: AttributeKey): key is NumericAttributeKey {
    return ATTRIBUTES[key].kind === "continuous" && key !== "color";
}

/**
 * Built-in defaults (FR-012, data-model §1). Wheel defaults and colorTemperature are profile-dependent and
 * resolved in profile.ts; the values here are their fallbacks.
 */
export const BUILT_IN_DEFAULTS: AttributeValueMap = {
    dimmer: 0,
    shutter: { mode: "open", rate: 10 },
    pan: 0,
    tilt: 0,
    panTiltSpeed: 1,
    color: [1, 1, 1],
    colorTemperature: 6500,
    colorWheel: 1,
    // 0 = no macro: the channel keeps its default (data-model §1)
    colorMacro: 0,
    goboWheel: 1,
    goboRotation: 0,
    prism: 0,
    prismRotation: 0,
    zoom: 0.5,
    focus: 0.5,
};

export function cloneValue<K extends AttributeKey>(key: K, value: AttributeValueMap[K]): AttributeValueMap[K] {
    if (key === "color") {
        return [...(value as Rgb)] as AttributeValueMap[K];
    }
    if (key === "shutter") {
        return { ...(value as ShutterValue) } as AttributeValueMap[K];
    }
    return value;
}

export function cloneValues(values: AttributeValueMap): AttributeValueMap {
    return { ...values, color: [...values.color], shutter: { ...values.shutter } };
}

function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

/**
 * Checks a value against data-model §1 and returns the sanitized value, or null if it is invalid.
 * - dimmer, panTiltSpeed, zoom, focus: clamped 0–1
 * - color: each 0–1
 * - colorWheel, goboWheel, colorMacro: integer 1…slot count (`slotCount` if known)
 * - prism: 0 = off, 1…slot count
 * - shutter: rate in Hz, ≥ 0
 * - pan, tilt, rotations, colorTemperature: finite numbers (clamped to the fixture's range at runtime)
 */
export function validateAttributeValue<K extends AttributeKey>(key: K, value: unknown, slotCount?: number): AttributeValueMap[K] | null {
    switch (key) {
        case "dimmer":
        case "panTiltSpeed":
        case "zoom":
        case "focus":
            return isFiniteNumber(value) ? (clamp01(value) as AttributeValueMap[K]) : null;
        case "pan":
        case "tilt":
        case "goboRotation":
        case "prismRotation":
        case "colorTemperature":
            return isFiniteNumber(value) ? (value as AttributeValueMap[K]) : null;
        case "color": {
            if (!Array.isArray(value) || value.length !== 3 || !value.every(isFiniteNumber)) {
                return null;
            }
            return [clamp01(value[0]), clamp01(value[1]), clamp01(value[2])] as AttributeValueMap[K];
        }
        case "colorWheel":
        case "goboWheel":
        case "colorMacro":
        case "prism": {
            const min = key === "prism" ? 0 : 1;
            if (!isFiniteNumber(value) || !Number.isInteger(value) || value < min) {
                return null;
            }
            if (slotCount !== undefined && value > slotCount) {
                return null;
            }
            return value as AttributeValueMap[K];
        }
        case "shutter": {
            if (typeof value !== "object" || value === null) {
                return null;
            }
            const v = value as Record<string, unknown>;
            if (v.mode !== "open" && v.mode !== "closed" && v.mode !== "strobe") {
                return null;
            }
            if (!isFiniteNumber(v.rate) || v.rate < 0) {
                return null;
            }
            return { mode: v.mode, rate: v.rate } as AttributeValueMap[K];
        }
    }
    return null;
}

/** Drops keys with invalid values (data-model §2). Keys the fixture does not support are kept. */
export function sanitizeAttributeValues(values: unknown): AttributeValues {
    const result: AttributeValues = {};
    if (typeof values !== "object" || values === null) {
        return result;
    }
    for (const key of ATTRIBUTE_KEYS) {
        const raw = (values as Record<string, unknown>)[key];
        if (raw === undefined) {
            continue;
        }
        const v = validateAttributeValue(key, raw);
        if (v !== null) {
            (result as Record<AttributeKey, AttributeValue>)[key] = v;
        }
    }
    return result;
}

// ---------------------------------------------------------------------------------------------------------------
// Fixture profile (runtime, cached in profile.ts)
// ---------------------------------------------------------------------------------------------------------------

export interface SlotInfo {
    /** 1-based; 0 = "off" for prism. */
    number: number;
    name: string;
    kind: "open" | "closed" | "color" | "gobo" | "prism" | "other";
    /** sRGB for color slots with exactly one color; null otherwise (split colors are never chosen by RGB, FR-006). */
    rgb: Rgb | null;
}

export interface Range {
    min: number;
    max: number;
}

export interface FixtureProfile {
    fixtureId: string;
    channelCount: number;
    supported: ReadonlySet<AttributeKey>;
    /** Pan/tilt as 0..1 because the mapping has no degree range (FR-003 fallback). */
    panTiltNormalized: boolean;
    ranges: Partial<Record<AttributeKey, Range>>;
    slots: Partial<Record<SlotAttributeKey, SlotInfo[]>>;
    /** Value of every channel when nothing writes it (OFL defaultValue or 0, FR-013). */
    channelDefaults: Uint8Array;
    /** Defaults before per-fixture overrides (built-in, profile-dependent). */
    builtInDefaults: AttributeValueMap;
    /** Defaults after per-fixture overrides (FR-012). */
    defaults: AttributeValueMap;
    /** Keys with a per-fixture default override. */
    overridden: ReadonlySet<AttributeKey>;
}

export interface EncodeResult {
    /** One value 0..255 per fixture channel. */
    values: Uint8Array;
    /** For every channel written by an attribute: the attribute (used for the raw-override rule, R4). */
    writtenBy: Array<AttributeKey | null>;
}

/** Clamps a numeric continuous value to the profile range (if any). */
export function clampToRange(profile: FixtureProfile, key: AttributeKey, v: number): number {
    const r = profile.ranges[key];
    return r ? Math.min(r.max, Math.max(r.min, v)) : v;
}

/** Display name of a slot value ("2 Red"), or the number if unknown. */
export function slotLabel(profile: FixtureProfile | null | undefined, key: SlotAttributeKey, value: number): string {
    const slot = profile?.slots[key]?.find((s) => s.number === value);
    return slot ? `${slot.number} ${slot.name}` : String(value);
}

/** Copy of `obj` without `key` (instead of a dynamic `delete`). */
export function omitKey<T extends object>(obj: T, key: PropertyKey): T {
    return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)) as T;
}
