/**
 * Attribute model and encoder contract (feature 004, research R1–R3, data-model §1).
 * Implemented in src/programming/{attributes,profile,encode,color}.ts.
 * Pure modules (no Vue/Pinia) except profile.ts, which resolves mappings from the stage and scene stores.
 */

import type { CapabilityMapping } from "@/visualization/capabilities/types";
import type { Fixture as OflFixture } from "@/stage/fixtures/dmx/open-fixture";

// ---------------------------------------------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------------------------------------------

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

/** attributes.ts */
export declare const ATTRIBUTES: Record<AttributeKey, AttributeInfo>;
export declare const BUILT_IN_DEFAULTS: AttributeValues; // per data-model §1; profile-dependent defaults resolved in profile.ts

// ---------------------------------------------------------------------------------------------------------------
// Fixture profile (runtime, cached)
// ---------------------------------------------------------------------------------------------------------------

export interface SlotInfo {
    /** 1-based; 0 = "off" for prism. */
    number: number;
    name: string;
    kind: "open" | "closed" | "color" | "gobo" | "prism" | "other";
    /** sRGB for color slots with exactly one color; null otherwise (split colors are never chosen by RGB, FR-006). */
    rgb: Rgb | null;
}

export interface FixtureProfile {
    fixtureId: string;
    channelCount: number;
    supported: ReadonlySet<AttributeKey>;
    /** Pan/tilt as 0..1 because the mapping has no degree range (FR-003 fallback). */
    panTiltNormalized: boolean;
    ranges: Partial<Record<AttributeKey, { min: number; max: number }>>;
    slots: Partial<Record<"colorWheel" | "goboWheel" | "prism" | "colorMacro", SlotInfo[]>>;
    /** Value of every channel when nothing writes it (OFL defaultValue or 0, FR-013). */
    channelDefaults: Uint8Array;
    /** Defaults after per-fixture overrides (FR-012). */
    defaults: Required<AttributeValueMap>;
}

/**
 * profile.ts: the mapping used for programming (research R2): the linked visualization's mapping, otherwise an
 * auto-generated one (type inferred: pan/tilt → Moving Head, matrix → Generic Fixture, else Spot). Cached.
 */
export type ResolveMapping = (fixtureId: string) => CapabilityMapping | null;
export type GetProfile = (fixtureId: string) => FixtureProfile | null;

// ---------------------------------------------------------------------------------------------------------------
// Encoder (pure)
// ---------------------------------------------------------------------------------------------------------------

export interface EncodeResult {
    /** One value 0..255 per fixture channel. */
    values: Uint8Array;
    /** For every channel written by an attribute: the attribute (used for the raw-override rule, R4). */
    writtenBy: Array<AttributeKey | null>;
}

/**
 * encode.ts: complete attribute set (defaults already applied) → DMX values for one fixture. Exact inverse of
 * feature 003's decode for every segment kind, so `decode(encode(v)) ≈ v` (SC-002).
 */
export type EncodeAttributes = (
    profile: FixtureProfile,
    mapping: CapabilityMapping,
    definition: OflFixture,
    values: Required<AttributeValueMap>
) => EncodeResult;

/** color.ts: OKLab distance (closest wheel slot) and the Kelvin → RGB approximation shared with decoding. */
export type ClosestColorSlot = (slots: SlotInfo[], rgb: Rgb) => number;
