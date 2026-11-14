/**
 * Capability mapping contract (feature 003, research R2/R3).
 * Implemented in src/visualization/capabilities/types.ts. Shared by the main window and the show window:
 * no Vue/Pinia imports. Stored inside FixtureVisualizationObject.config (project data).
 *
 * Units: degrees, Hz, rotations per second (rps), Kelvin, values 0..1 unless noted.
 */

import type { Fixture as OflFixture } from "@/stage/fixtures/dmx/open-fixture";
import type { VisualizationType } from "@/visualization/fixtureVisualization";
import type { FixtureAssetDefinition } from "@/assetLibrary/types";

// ---------------------------------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------------------------------

/** Fixture-wide capabilities. Not every visualization type uses every key (see KEYS_BY_TYPE in data-model.md). */
export type CapabilityKey =
    // position
    | "pan"
    | "tilt"
    | "panTiltSpeed"
    // intensity
    | "dimmer"
    | "shutter"
    // additive color
    | "red"
    | "green"
    | "blue"
    | "white"
    | "amber"
    | "uv"
    | "lime"
    | "indigo"
    | "warmWhite"
    | "coldWhite"
    // subtractive color
    | "cyan"
    | "magenta"
    | "yellow"
    // color modifiers
    | "colorTemperature"
    | "colorMacro"
    | "colorWheel"
    | "colorWheelRotation"
    // beam
    | "zoom"
    | "focus"
    | "goboWheel"
    | "goboWheelRotation"
    | "goboRotation"
    | "prism"
    | "prismRotation"
    // special effects (research R14)
    | "trigger"
    | "height"
    | "laserPattern"
    | "laserSize"
    | "laserRotation"
    | "laserX"
    | "laserY"
    | "laserSpeed"
    | "fogOutput";

// ---------------------------------------------------------------------------------------------------------------
// Segments: what a DMX range means
// ---------------------------------------------------------------------------------------------------------------

/** DMX values are inclusive. A 16-bit channel uses 0..65535; an 8-bit channel 0..255. */
export interface DmxSpan {
    from: number;
    to: number;
}

/** Linear value from `start` (at `from`) to `end` (at `to`), e.g. pan −270..270, dimmer 0..1, zoom 10..40. */
export interface LinearSegment extends DmxSpan {
    kind: "linear";
    start: number;
    end: number;
}

export type ShutterEffect = "open" | "closed" | "strobe" | "pulse" | "rampUp" | "rampDown" | "rampUpDown" | "random";

/** Shutter/strobe range; `rateStart`/`rateEnd` in Hz (0 for open/closed). */
export interface ShutterSegment extends DmxSpan {
    kind: "shutter";
    effect: ShutterEffect;
    rateStart: number;
    rateEnd: number;
}

/**
 * Wheel position. `slotStart`/`slotEnd` are 1-based slot numbers of the referenced wheel; fractional values
 * (continuous scrolling) blend between neighbouring slots. A fixed slot has slotStart === slotEnd.
 */
export interface WheelSlotSegment extends DmxSpan {
    kind: "wheelSlot";
    slotStart: number;
    slotEnd: number;
}

/** Continuous rotation, rps; negative = counter-clockwise. Also used for gobo/prism rotation speed. */
export interface RotationSegment extends DmxSpan {
    kind: "rotation";
    speedStart: number;
    speedEnd: number;
}

/** Fixed angle index, degrees (gobo/prism indexing). */
export interface AngleSegment extends DmxSpan {
    kind: "angle";
    start: number;
    end: number;
}

/** A color preset/macro: "#rrggbb" colors (2 = split), or a color temperature in K. */
export interface ColorSegment extends DmxSpan {
    kind: "color";
    colors: string[];
    temperature: number | null;
}

/** Laser pattern selection: index into the built-in pattern set (research R14). */
export interface PatternSegment extends DmxSpan {
    kind: "pattern";
    pattern: LaserPattern;
}

/** Range without visual effect (e.g. "no function", maintenance). */
export interface NoneSegment extends DmxSpan {
    kind: "none";
}

export type CapabilitySegment =
    | LinearSegment
    | ShutterSegment
    | WheelSlotSegment
    | RotationSegment
    | AngleSegment
    | ColorSegment
    | PatternSegment
    | NoneSegment;

export type LaserPattern = "beam" | "fan" | "cone" | "sheet" | "dots";

// ---------------------------------------------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------------------------------------------

export interface CapabilityChannel {
    /** Coarse DMX channel index within the fixture (0-based), −1 = not mapped. */
    channel: number;
    /** Fine channel index for 16-bit, −1 = none. */
    fine: number;
    /** Sorted by `from`, non-overlapping; DMX values outside every segment keep the last decoded value. */
    segments: CapabilitySegment[];
    /** Decoded value used while `channel === −1` (in the unit of the key; FR-003 defaults in data-model.md). */
    defaultValue: number;
    /** "manual" entries are never overwritten except by an explicit Auto-Assign (FR-011). */
    source: "auto" | "manual";
    /** For wheel keys: name of the wheel in `CapabilityMapping.wheels`. */
    wheel?: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Wheels (copied from the OFL definition, research R9)
// ---------------------------------------------------------------------------------------------------------------

export type WheelSlot =
    | { type: "open" }
    | { type: "closed" }
    /** colors: 1 = solid, 2 = split color; temperature in K (CTO/CTB filters), null if colors are given. */
    | { type: "color"; name: string; colors: string[]; temperature: number | null }
    /** image: SVG markup (≤ 32 KB) or `generic:<n>` (0..11, built-in pattern). */
    | { type: "gobo"; name: string; image: string }
    | { type: "prism"; name: string; facets: number }
    | { type: "frost" }
    | { type: "iris"; open: number };

export interface WheelDefinition {
    slots: WheelSlot[];
    /** Direction of increasing slot numbers when the wheel rotates. */
    direction: "CW" | "CCW";
}

// ---------------------------------------------------------------------------------------------------------------
// Cells (multi-cell fixtures, FR-034)
// ---------------------------------------------------------------------------------------------------------------

export interface CellMapping {
    /** Emitter id of the model (feature 002, "cell-<n>" / "cell-<row>-<col>"), or "pixel:<key>" if no model cell. */
    emitter: string;
    /** OFL pixel key the channels come from. */
    pixelKey: string;
    /** Channel indices, −1 = not mapped. Missing dimmer = fixture dimmer only; missing color = fixture color. */
    dimmer: number;
    red: number;
    green: number;
    blue: number;
    white: number;
    amber: number;
    uv: number;
}

// ---------------------------------------------------------------------------------------------------------------
// The mapping
// ---------------------------------------------------------------------------------------------------------------

export interface CapabilityMapping {
    /** Only keys that the visualization type supports are present. */
    channels: Partial<Record<CapabilityKey, CapabilityChannel>>;
    wheels: Record<string, WheelDefinition>;
    cells: CellMapping[];
    /** Mode name and channel count the mapping was generated for (research R3, point 6); null = manual only. */
    mappedMode: string | null;
    mappedChannelCount: number;
}

/** Empty mapping: no channels, wheels or cells; manual only (mappedMode null). */
export function emptyMapping(): CapabilityMapping {
    return { channels: {}, wheels: {}, cells: [], mappedMode: null, mappedChannelCount: 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// API (src/visualization/capabilities/*)
// ---------------------------------------------------------------------------------------------------------------

export type OflMode = OflFixture["modes"][number];

/** autoMap.ts: complete mapping for a type; unsupported or ambiguous channels stay unmapped (US2.2). */
export type AutoMapCapabilities = (
    definition: OflFixture,
    mode: OflMode,
    type: VisualizationType,
    model: FixtureAssetDefinition | null
) => CapabilityMapping;

/** oflResolve.ts: channels of a mode in DMX order, `null` channels included (research R3, point 1). */
export interface ResolvedChannel {
    index: number;
    /** Channel key as in the mode ("Pan", "Red 3", "(unused)"). */
    key: string;
    capabilities: Array<Record<string, unknown> & { type: string; dmxRange?: [number, number] }>;
    /** Set on fine channels: index of the coarse channel. */
    fineOf?: number;
    /** Set on matrix channels. */
    pixelKey?: string;
}
export type ResolveModeChannels = (definition: OflFixture, mode: OflMode) => ResolvedChannel[];

/** Channels of the current mode that no mapping entry or cell references (shown as "Unmapped" in the editor). */
export type UnmappedChannels = (mapping: CapabilityMapping, channels: ResolvedChannel[]) => ResolvedChannel[];

/** Raw value of a channel pair: 0..255 for 8-bit, 0..65535 when `fine >= 0` (FR-001, 16-bit). */
export type ReadDmx = (entry: CapabilityChannel, values: Uint8Array) => number | null;

/** Decoded scalar of a linear/angle/rotation key; `defaultValue` when unmapped. */
export type DecodeScalar = (entry: CapabilityChannel | undefined, values: Uint8Array, fallback: number) => number;
