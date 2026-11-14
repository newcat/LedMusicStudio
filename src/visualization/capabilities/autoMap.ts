/**
 * Automatic capability mapping from the OFL definition (feature 003, research R3/R14, data-model.md §1).
 *
 * `autoMapCapabilities(definition, mode, type, model)` maps every supported capability of the mode's channels to
 * the keys of the visualization type, with ranges, wheels and (Generic Fixture) cells. Ambiguous or unknown
 * channels stay unmapped. `describeMapping` prints a mapping for the SC-001 checklist (dev console helper).
 *
 * Shared by the main window and the show window: no Vue/Pinia imports.
 */

import type { FixtureAssetDefinition } from "@/assetLibrary/types";
import type { Fixture as OflFixture, WheelSlot as OflWheelSlot } from "@/stage/fixtures/dmx/open-fixture";
import type { VisualizationType } from "@/visualization/fixtureVisualization";
import { KEY_INFO, KEYS_BY_TYPE } from "./keys";
import {
    goboImageOf,
    parseAngle,
    parseBrightness,
    parseKelvin,
    parseRotationRps,
    parseSpeedHz,
    resolveModeChannels,
    UNUSED_CHANNEL_KEY,
    type OflResolvedChannel,
} from "./oflResolve";
import { sanitizeSegments } from "./sanitizeMapping";
import type {
    CapabilityChannel,
    CapabilityKey,
    CapabilityMapping,
    CapabilitySegment,
    CellMapping,
    LaserPattern,
    OflMode,
    ShutterEffect,
    WheelDefinition,
    WheelSlot,
} from "./types";
import { emptyMapping } from "./types";

type Cap = OflResolvedChannel["capabilities"][number];
type Rec = Record<string, unknown>;

/** What a single OFL capability maps to. `wheel` is set for wheel capabilities. */
interface CapTarget {
    key: CapabilityKey;
    wheel?: string;
}

/** Wheel kinds that have keys (frost/iris-only wheels are not mapped). */
type WheelKind = "color" | "gobo" | "prism";

/** Everything the per-capability rules need. */
interface MapContext {
    definition: OflFixture;
    mode: OflMode;
    supported: Set<CapabilityKey>;
    model: FixtureAssetDefinition | null;
    wheelKinds: Map<string, WheelKind>;
    /** Lens angles `[narrow, wide]` from the mode or the definition, null if unknown. */
    lens: [number, number] | null;
    /** The mode has a channel with a StrobeSpeed capability (strobe rate on its own channel). */
    hasStrobeSpeed: boolean;
}

const COLOR_KEYS: Record<string, CapabilityKey> = {
    red: "red",
    green: "green",
    blue: "blue",
    cyan: "cyan",
    magenta: "magenta",
    yellow: "yellow",
    amber: "amber",
    white: "white",
    "warm white": "warmWhite",
    "cold white": "coldWhite",
    uv: "uv",
    lime: "lime",
    indigo: "indigo",
};

const SHUTTER_EFFECTS: Record<string, ShutterEffect> = {
    Open: "open",
    Closed: "closed",
    Strobe: "strobe",
    Pulse: "pulse",
    RampUp: "rampUp",
    RampDown: "rampDown",
    RampUpDown: "rampUpDown",
    Lightning: "random",
    Spikes: "random",
    Burst: "random",
};

const LASER_PATTERNS: LaserPattern[] = ["beam", "fan", "cone", "sheet", "dots"];

/** Strobe rate range used when an OFL strobe capability gives no speed. */
const DEFAULT_STROBE_HZ: [number, number] = [1, 20];
const DEFAULT_ZOOM: [number, number] = [10, 45];
const GENERIC_GOBO_COUNT = 12;
const ANIMATION_GOBO = "generic:11";
/** colorMacro is not taken from a channel whose only color preset spans fewer DMX values than this (10 %). */
const MIN_SINGLE_RANGE_COVERAGE = 26;

// ---------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------

function str(cap: Rec, field: string): string | undefined {
    const v = cap[field];
    return typeof v === "string" ? v : undefined;
}

function num(cap: Rec, field: string): number | undefined {
    const v = cap[field];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** `[start, end]` of an OFL entity pair (`xStart`/`xEnd`, or a single `x` for both). */
function entityPair(cap: Rec, field: string): [string | undefined, string | undefined] {
    const single = str(cap, field);
    if (single !== undefined) {
        return [single, single];
    }
    return [str(cap, field + "Start"), str(cap, field + "End")];
}

/** Parses an entity pair; missing or unparsable halves fall back to `fallback`. */
function parsedPair(cap: Rec, field: string, parse: (v: string | undefined) => number | null, fallback: [number, number]): [number, number] {
    const [a, b] = entityPair(cap, field);
    return [parse(a) ?? fallback[0], parse(b) ?? fallback[1]];
}

function hasEntity(cap: Rec, field: string): boolean {
    return str(cap, field) !== undefined || str(cap, field + "Start") !== undefined || str(cap, field + "End") !== undefined;
}

function dmxRange(cap: Cap): [number, number] {
    return cap.dmxRange ?? [0, 255];
}

function naturalCompare(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function tokens(text: string): string[] {
    return text
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 0);
}

/** "#abc" / "#AABBCC" → "#aabbcc"; anything else → null. */
function normalizeHex(color: unknown): string | null {
    if (typeof color !== "string") {
        return null;
    }
    const c = color.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(c)) {
        return c;
    }
    if (/^#[0-9a-f]{3}$/.test(c)) {
        return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    }
    return null;
}

/** Up to two normalized colors (two = split); two equal colors collapse to one. */
function hexList(colors: unknown): string[] {
    const list = Array.isArray(colors) ? colors.map(normalizeHex).filter((c): c is string => c !== null).slice(0, 2) : [];
    return list.length === 2 && list[0] === list[1] ? [list[0]] : list;
}

// ---------------------------------------------------------------------------------------------------------------
// Wheels
// ---------------------------------------------------------------------------------------------------------------

/** Wheel name of a wheel capability: its `wheel` property (first entry of a list), else the channel name. */
function wheelNameOf(cap: Cap, channel: OflResolvedChannel, definition: OflFixture): string {
    const wheel = (cap as Rec).wheel;
    if (typeof wheel === "string") {
        return wheel;
    }
    if (Array.isArray(wheel) && typeof wheel[0] === "string") {
        return wheel[0];
    }
    const name = definition.availableChannels?.[channel.key]?.name;
    return typeof name === "string" ? name : channel.key;
}

function wheelKindOf(slots: OflWheelSlot[]): WheelKind | null {
    if (slots.some((s) => s.type === "Gobo" || s.type === "AnimationGoboStart" || s.type === "AnimationGoboEnd")) {
        return "gobo";
    }
    if (slots.some((s) => s.type === "Color")) {
        return "color";
    }
    if (slots.some((s) => s.type === "Prism")) {
        return "prism";
    }
    return null;
}

function irisOpen(value: string | undefined): number {
    if (value === "closed") {
        return 0;
    }
    if (value === "open" || value === undefined) {
        return 1;
    }
    const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(value);
    return m ? Math.min(1, Math.max(0, Number(m[1]) / 100)) : 1;
}

/** OFL wheel slot → stored slot (data-model.md §1 "Wheels"). */
function convertSlot(slot: OflWheelSlot, index: number): WheelSlot {
    switch (slot.type) {
        case "Open":
            return { type: "open" };
        case "Closed":
            return { type: "closed" };
        case "Color": {
            const colors = hexList(slot.colors);
            const temperature = colors.length === 0 ? parseKelvin(slot.colorTemperature) : null;
            return {
                type: "color",
                name: slot.name ?? `Color ${index + 1}`,
                colors: colors.length === 0 && temperature === null ? ["#ffffff"] : colors,
                temperature,
            };
        }
        case "Gobo": {
            const resourceName = typeof slot.resource === "object" && slot.resource !== null ? (slot.resource as Rec).name : undefined;
            return {
                type: "gobo",
                name: slot.name ?? (typeof resourceName === "string" ? resourceName : `Gobo ${index + 1}`),
                image: goboImageOf(slot) ?? `generic:${index % GENERIC_GOBO_COUNT}`,
            };
        }
        case "Prism":
            return { type: "prism", name: slot.name ?? `Prism ${index + 1}`, facets: Math.min(8, Math.max(2, Math.round(slot.facets ?? 3))) };
        case "Frost":
            return { type: "frost" };
        case "Iris":
            return { type: "iris", open: irisOpen(slot.openPercent) };
        case "AnimationGoboStart":
            return { type: "gobo", name: slot.name ?? "Animation", image: ANIMATION_GOBO };
        case "AnimationGoboEnd":
            return { type: "gobo", name: "Animation", image: ANIMATION_GOBO };
        default:
            return { type: "open" };
    }
}

function convertWheels(definition: OflFixture): Record<string, WheelDefinition> {
    const wheels: Record<string, WheelDefinition> = {};
    for (const [name, wheel] of Object.entries(definition.wheels ?? {})) {
        wheels[name] = {
            slots: (wheel.slots ?? []).map((slot, i) => convertSlot(slot as OflWheelSlot, i)),
            direction: wheel.direction === "CCW" ? "CCW" : "CW",
        };
    }
    return wheels;
}

// ---------------------------------------------------------------------------------------------------------------
// Capability → key (research R3 table, R14 keywords)
// ---------------------------------------------------------------------------------------------------------------

function firstSupported(ctx: MapContext, ...keys: CapabilityKey[]): CapabilityKey | null {
    return keys.find((k) => ctx.supported.has(k)) ?? null;
}

/**
 * Special-effect key of an `Effect`/`Generic`/`EffectParameter` capability from keywords in the channel key and
 * effect name (R14); `Generic` has no effect name, so its comment is used. Besides the R14 keywords, "fountain",
 * "valve", "ignit" and "pyro" also mark a trigger (spark fountains, CO2 valves, flame ignition in the OFL data).
 */
function effectKeyOf(ctx: MapContext, cap: Cap, channel: OflResolvedChannel): CapabilityKey | null {
    const label = cap.type === "Generic" ? str(cap, "comment") : str(cap, "effectName");
    const text = `${channel.key} ${label ?? ""}`.toLowerCase();
    const words = tokens(text);
    const has = (...needles: string[]) => needles.some((n) => text.includes(n));
    const word = (...needles: string[]) => needles.some((n) => words.includes(n));
    const candidates: Array<[boolean, CapabilityKey]> = [
        [has("height"), "height"],
        [has("size", "zoom"), "laserSize"],
        [has("rotat"), "laserRotation"],
        [word("x", "horizontal", "move", "movement"), "laserX"],
        [word("y", "vertical"), "laserY"],
        [has("pattern", "figure", "gobo"), "laserPattern"],
        [has("flame", "fire", "co2", "jet", "spark", "fountain", "valve", "ignit", "pyro"), "trigger"],
    ];
    for (const [match, key] of candidates) {
        if (match && ctx.supported.has(key)) {
            return key;
        }
    }
    return null;
}

function wheelKeyOf(ctx: MapContext, cap: Cap, channel: OflResolvedChannel): CapTarget | null {
    const wheel = wheelNameOf(cap, channel, ctx.definition);
    const kind = ctx.wheelKinds.get(wheel);
    if (!kind) {
        return null;
    }
    const keys: Record<string, Partial<Record<WheelKind, CapabilityKey>>> = {
        WheelSlot: { color: "colorWheel", gobo: "goboWheel", prism: "prism" },
        WheelShake: { color: "colorWheel", gobo: "goboWheel", prism: "prism" },
        WheelRotation: { color: "colorWheelRotation", gobo: "goboWheelRotation", prism: "prismRotation" },
        WheelSlotRotation: { gobo: "goboRotation", prism: "prismRotation" },
    };
    const key = keys[cap.type]?.[kind];
    return key && ctx.supported.has(key) ? { key, wheel } : null;
}

/** The key a capability maps to for this visualization type, or null. */
function targetOf(ctx: MapContext, cap: Cap, channel: OflResolvedChannel): CapTarget | null {
    const key = (k: CapabilityKey | null): CapTarget | null => (k && ctx.supported.has(k) ? { key: k } : null);
    switch (cap.type) {
        case "Pan":
            return key("pan");
        case "Tilt":
            return key("tilt");
        case "PanTiltSpeed":
            return key("panTiltSpeed");
        case "Intensity":
            return key(firstSupported(ctx, "dimmer", "trigger"));
        case "ShutterStrobe":
        case "StrobeSpeed":
            return key("shutter");
        case "ColorIntensity":
            return key(COLOR_KEYS[(str(cap, "color") ?? "").toLowerCase()] ?? null);
        case "ColorTemperature":
            return key("colorTemperature");
        case "ColorPreset":
            return key("colorMacro");
        case "WheelSlot":
        case "WheelShake":
        case "WheelRotation":
        case "WheelSlotRotation":
            return wheelKeyOf(ctx, cap, channel);
        case "Zoom":
        case "BeamAngle":
            return key(firstSupported(ctx, "zoom", "laserSize"));
        case "Focus":
            return key("focus");
        case "Prism":
            return key("prism");
        case "PrismRotation":
            return key("prismRotation");
        case "Fog":
        case "FogOutput":
            return key("fogOutput");
        case "Rotation":
            return key("laserRotation");
        case "EffectSpeed":
        case "Speed":
            return key("laserSpeed");
        case "BeamPosition":
            return key(hasEntity(cap as Rec, "horizontalAngle") ? "laserX" : hasEntity(cap as Rec, "verticalAngle") ? "laserY" : null);
        case "Effect":
        case "EffectParameter":
        case "Generic":
            return key(effectKeyOf(ctx, cap, channel));
        default:
            return null;
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Segments (research R3, point 3)
// ---------------------------------------------------------------------------------------------------------------

function linear(cap: Cap, start: number, end: number): CapabilitySegment {
    const [from, to] = dmxRange(cap);
    return { kind: "linear", from, to, start, end };
}

function none(cap: Cap): CapabilitySegment {
    const [from, to] = dmxRange(cap);
    return { kind: "none", from, to };
}

function defaultRange(key: CapabilityKey): [number, number] {
    return KEY_INFO[key].defaultRange ?? [0, 1];
}

/** Pan/tilt angles of all capabilities of the key on the channel, centered so the middle of the range is 0°. */
function positionAngles(ctx: MapContext, key: "pan" | "tilt", caps: Cap[]): Map<Cap, [number, number]> | null {
    const part = ctx.model?.fixture.movingParts?.[key];
    const physical = part ? part.max - part.min : key === "pan" ? 540 : 270;
    const result = new Map<Cap, [number, number]>();
    let min = Infinity;
    let max = -Infinity;
    for (const cap of caps) {
        const [a, b] = entityPair(cap as Rec, "angle");
        const start = parseAngle(a, physical);
        const end = parseAngle(b, physical);
        if (start === null || end === null) {
            return null;
        }
        result.set(cap, [start, end]);
        min = Math.min(min, start, end);
        max = Math.max(max, start, end);
    }
    if (result.size === 0) {
        return null;
    }
    const offset = (min + max) / 2;
    for (const [cap, [s, e]] of result) {
        result.set(cap, [s - offset, e - offset]);
    }
    return result;
}

function positionFallback(ctx: MapContext, key: "pan" | "tilt"): [number, number] {
    const part = ctx.model?.fixture.movingParts?.[key];
    return part ? [part.min, part.max] : defaultRange(key);
}

function zoomAngle(value: string | undefined, lens: [number, number]): number | null {
    if (value === undefined) {
        return null;
    }
    switch (value.trim().toLowerCase()) {
        case "narrow":
            return lens[0];
        case "wide":
            return lens[1];
        case "closed":
            return 0;
    }
    const m = /^\s*([+-]?\d+(?:\.\d+)?)\s*%\s*$/.exec(value);
    if (m) {
        return lens[0] + ((lens[1] - lens[0]) * Number(m[1])) / 100;
    }
    return parseAngle(value, lens[1]);
}

/** Focus distance entity as 0..1: near 0, far 1, "%" as is; meters give null (default range). */
function focusRatio(value: string | undefined): number | null {
    const v = value?.trim().toLowerCase();
    if (v === undefined) {
        return null;
    }
    if (v === "near") {
        return 0;
    }
    if (v === "far") {
        return 1;
    }
    const p = percent(v);
    return p === null ? null : Math.max(0, Math.min(1, p));
}

function fogLevel(value: string | undefined): number | null {
    switch (value?.trim().toLowerCase()) {
        case "off":
            return 0;
        case "weak":
            return 0.3;
        case "strong":
            return 1;
    }
    return parseBrightness(value);
}

/** Trigger level of an `EffectParameter` keyword: "off" 0, low/slow/small/short 0.5, high/fast/big/long 1, "%" as is. */
function effectParameterLevel(value: string | undefined): number | null {
    const v = value?.trim().toLowerCase();
    switch (v) {
        case undefined:
            return null;
        case "off":
            return 0;
        case "low":
        case "slow":
        case "small":
        case "short":
            return 0.5;
        case "high":
        case "fast":
        case "big":
        case "long":
            return 1;
    }
    return percent(v);
}

function percent(value: string): number | null {
    const m = /^\s*([+-]?\d+(?:\.\d+)?)\s*%\s*$/.exec(value);
    return m ? Number(m[1]) / 100 : null;
}

/** Laser size from a zoom/beam angle entity: narrow 0, wide 1, "%" as is. */
function sizeRatio(value: string | undefined): number | null {
    const v = value?.trim().toLowerCase();
    if (v === undefined) {
        return null;
    }
    if (v === "narrow" || v === "closed") {
        return 0;
    }
    if (v === "wide") {
        return 1;
    }
    return percent(v);
}

/** BeamPosition entity as −1..1: left/bottom −1, center 0, right/top 1, "%" of the full swing, degrees / 90. */
function beamPositionRatio(value: string | undefined): number | null {
    const v = value?.trim().toLowerCase();
    switch (v) {
        case undefined:
            return null;
        case "left":
        case "bottom":
            return -1;
        case "center":
            return 0;
        case "right":
        case "top":
            return 1;
    }
    const p = percent(v);
    if (p !== null) {
        return Math.max(-1, Math.min(1, p));
    }
    const deg = parseAngle(v, 90);
    return deg === null ? null : Math.max(-1, Math.min(1, deg / 90));
}

/** Speed entity as a 0..1 ratio of "fast": fast 1, slow 0, stop 0, "%" as is. */
function speedRatio(value: string | undefined): number | null {
    const v = value?.trim().toLowerCase();
    if (v === undefined) {
        return null;
    }
    if (v.startsWith("fast")) {
        return 1;
    }
    if (v.startsWith("slow") || v === "stop") {
        return 0;
    }
    const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(v);
    return m ? Math.min(1, Number(m[1]) / 100) : null;
}

function rotationSegment(cap: Cap, key: CapabilityKey, fallbackToDefault: boolean): CapabilitySegment {
    const [from, to] = dmxRange(cap);
    const [sa, sb] = entityPair(cap as Rec, "speed");
    const speedStart = parseRotationRps(sa);
    const speedEnd = parseRotationRps(sb);
    if (speedStart !== null || speedEnd !== null) {
        return { kind: "rotation", from, to, speedStart: speedStart ?? speedEnd!, speedEnd: speedEnd ?? speedStart! };
    }
    const [aa, ab] = entityPair(cap as Rec, "angle");
    const angleStart = parseAngle(aa, 360);
    const angleEnd = parseAngle(ab, 360);
    if (angleStart !== null || angleEnd !== null) {
        return { kind: "angle", from, to, start: angleStart ?? angleEnd!, end: angleEnd ?? angleStart! };
    }
    if (!fallbackToDefault) {
        return none(cap);
    }
    const [s, e] = defaultRange(key);
    return { kind: "rotation", from, to, speedStart: s, speedEnd: e };
}

/**
 * Wheel rotation ranges of a slot channel: a speed spins the wheel; an angle positions it, so it becomes a
 * continuous slot range (0° = slot 1, 360° = once around).
 */
function wheelRotationOnSlotChannel(ctx: MapContext, cap: Cap, wheel: string | undefined): CapabilitySegment {
    const segment = rotationSegment(cap, "colorWheelRotation", false);
    const slotCount = wheel !== undefined ? (ctx.definition.wheels?.[wheel]?.slots?.length ?? 0) : 0;
    if (segment.kind !== "angle" || slotCount === 0) {
        return segment;
    }
    const slot = (deg: number) => 1 + (deg / 360) * slotCount;
    return { kind: "wheelSlot", from: segment.from, to: segment.to, slotStart: slot(segment.start), slotEnd: slot(segment.end) };
}

function wheelSlotSegment(cap: Cap): CapabilitySegment {
    const [from, to] = dmxRange(cap);
    const single = num(cap as Rec, "slotNumber");
    const start = single ?? num(cap as Rec, "slotNumberStart");
    const end = single ?? num(cap as Rec, "slotNumberEnd");
    if (start === undefined && end === undefined) {
        return none(cap);
    }
    return { kind: "wheelSlot", from, to, slotStart: start ?? end!, slotEnd: end ?? start! };
}

function shutterSegment(cap: Cap): CapabilitySegment {
    const [from, to] = dmxRange(cap);
    const named = SHUTTER_EFFECTS[str(cap as Rec, "shutterEffect") ?? ""] ?? "strobe";
    const effect: ShutterEffect = named === "strobe" && (cap as Rec).randomTiming === true ? "random" : named;
    if (effect === "open" || effect === "closed") {
        return { kind: "shutter", from, to, effect, rateStart: 0, rateEnd: 0 };
    }
    const [a, b] = entityPair(cap as Rec, "speed");
    const rateStart = parseSpeedHz(a);
    const rateEnd = parseSpeedHz(b);
    return {
        kind: "shutter",
        from,
        to,
        effect,
        rateStart: rateStart ?? rateEnd ?? DEFAULT_STROBE_HZ[0],
        rateEnd: rateEnd ?? rateStart ?? DEFAULT_STROBE_HZ[1],
    };
}

function colorPresetSegment(cap: Cap): CapabilitySegment {
    const [from, to] = dmxRange(cap);
    const rec = cap as Rec;
    const colors = hexList(rec.colors ?? rec.colorsStart);
    const [ta, tb] = entityPair(rec, "colorTemperature");
    const temperature = colors.length === 0 ? (parseKelvin(ta) ?? parseKelvin(tb)) : null;
    if (colors.length === 0 && temperature === null) {
        return none(cap);
    }
    return { kind: "color", from, to, colors, temperature };
}

/** Pattern of a laser effect from its name, else cycled by index. */
function patternSegment(cap: Cap, index: number): CapabilitySegment {
    const [from, to] = dmxRange(cap);
    const name = (str(cap as Rec, "effectName") ?? "").toLowerCase();
    const byName: Array<[string[], LaserPattern]> = [
        [["fan"], "fan"],
        [["cone", "tunnel", "circle"], "cone"],
        [["sheet", "line", "wave"], "sheet"],
        [["dot", "star"], "dots"],
        [["beam"], "beam"],
    ];
    const named = byName.find(([needles]) => needles.some((n) => name.includes(n)));
    return { kind: "pattern", from, to, pattern: named ? named[1] : LASER_PATTERNS[index % LASER_PATTERNS.length] };
}

/** Segment of a capability that maps to `key` (research R3, point 3). */
function typedSegment(ctx: MapContext, target: CapTarget, cap: Cap, positions: Map<Cap, [number, number]> | null, index: number): CapabilitySegment {
    const rec = cap as Rec;
    const key = target.key;
    switch (key) {
        case "pan":
        case "tilt": {
            const [s, e] = positions?.get(cap) ?? positionFallback(ctx, key);
            return linear(cap, s, e);
        }
        case "dimmer":
        case "red":
        case "green":
        case "blue":
        case "white":
        case "amber":
        case "uv":
        case "lime":
        case "indigo":
        case "warmWhite":
        case "coldWhite":
        case "cyan":
        case "magenta":
        case "yellow": {
            const [s, e] = parsedPair(rec, "brightness", parseBrightness, [0, 1]);
            return linear(cap, s, e);
        }
        case "shutter":
            return shutterSegment(cap);
        case "colorTemperature": {
            const [s, e] = parsedPair(rec, "colorTemperature", parseKelvin, defaultRange(key));
            return linear(cap, s, e);
        }
        case "colorMacro":
            return colorPresetSegment(cap);
        case "zoom": {
            const lens = ctx.lens ?? DEFAULT_ZOOM;
            const [a, b] = entityPair(rec, "angle");
            return linear(cap, zoomAngle(a, lens) ?? lens[0], zoomAngle(b, lens) ?? lens[1]);
        }
        case "focus": {
            // feature 004 (research R1): near → 0, far → 1, percentages as is; meters keep the default range
            const [s, e] = parsedPair(rec, "distance", focusRatio, [0, 1]);
            return linear(cap, s, e);
        }
        case "colorWheel":
        case "goboWheel":
            return cap.type === "WheelRotation" ? wheelRotationOnSlotChannel(ctx, cap, target.wheel) : wheelSlotSegment(cap);
        case "prism":
            if (cap.type === "Prism") {
                return linear(cap, 3, 3);
            }
            return cap.type === "WheelRotation" || cap.type === "WheelSlotRotation" ? none(cap) : wheelSlotSegment(cap);
        case "colorWheelRotation":
        case "goboWheelRotation":
        case "goboRotation":
        case "prismRotation":
        case "laserRotation":
            return rotationSegment(cap, key, true);
        case "panTiltSpeed": {
            // 0 = fast (configured speed), 1 = slow.
            const [a, b] = entityPair(rec, "speed");
            const sa = speedRatio(a);
            const sb = speedRatio(b);
            return linear(cap, sa === null ? 0 : 1 - sa, sb === null ? 1 : 1 - sb);
        }
        case "laserSpeed": {
            const [s, e] = parsedPair(rec, "speed", speedRatio, [0, 1]);
            return linear(cap, s, e);
        }
        case "fogOutput": {
            const [s, e] = parsedPair(rec, "fogOutput", fogLevel, [0, 1]);
            return linear(cap, s, e);
        }
        case "trigger": {
            if (cap.type === "Intensity") {
                const [s, e] = parsedPair(rec, "brightness", parseBrightness, [0, 1]);
                return linear(cap, s, e);
            }
            if (cap.type === "EffectParameter") {
                // "off" … "high" (MagicFX Stage Flame): off at the bottom of the range, not held on
                const [s, e] = parsedPair(rec, "parameter", effectParameterLevel, [1, 1]);
                return linear(cap, s, e);
            }
            return linear(cap, 1, 1);
        }
        case "laserPattern":
            return patternSegment(cap, index);
        case "laserSize":
            if (cap.type === "Zoom" || cap.type === "BeamAngle") {
                const [s, e] = parsedPair(rec, "angle", sizeRatio, [0, 1]);
                return linear(cap, s, e);
            }
            return linear(cap, ...defaultRange(key));
        case "laserX":
        case "laserY":
            if (cap.type === "BeamPosition") {
                const field = key === "laserX" ? "horizontalAngle" : "verticalAngle";
                const [a, b] = entityPair(rec, field);
                const degA = parseAngle(a, 90);
                const degB = parseAngle(b, 90);
                if (degA !== null && degB !== null && a !== undefined && !a.includes("%") && degA !== degB) {
                    // absolute angles: centered, the full swing is −1…1
                    return linear(cap, degA < degB ? -1 : 1, degA < degB ? 1 : -1);
                }
                const [s, e] = parsedPair(rec, field, beamPositionRatio, defaultRange(key));
                return linear(cap, s, e);
            }
            return linear(cap, ...defaultRange(key));
        case "height": {
            const [s, e] = defaultRange(key);
            return linear(cap, s, e);
        }
    }
}

/** Segment of a capability on the channel that does not map to `key`. */
function foreignSegment(key: CapabilityKey, cap: Cap): CapabilitySegment {
    if (key === "dimmer" && cap.type === "ShutterStrobe") {
        // combined dimmer/strobe channel: full intensity while strobing
        return linear(cap, 1, 1);
    }
    if (key === "shutter") {
        // other functions on a shutter channel (programs, "DMX mode") leave the light ungated
        const [from, to] = dmxRange(cap);
        return { kind: "shutter", from, to, effect: "open", rateStart: 0, rateEnd: 0 };
    }
    if (key === "trigger" || key === "fogOutput") {
        // effects are off outside their ranges, never held (research R14)
        return linear(cap, 0, 0);
    }
    return none(cap);
}

/** Whether `cap` contributes typed segments to the entry of `target` (wheel slot channels include their rotation). */
function belongsTo(ctx: MapContext, cap: Cap, channel: OflResolvedChannel, target: CapTarget): boolean {
    if (target.key === "prismRotation" && target.wheel === undefined && isPrismWithSpeed(cap)) {
        return true;
    }
    const t = targetOf(ctx, cap, channel);
    if (!t) {
        return false;
    }
    if (t.key === target.key && t.wheel === target.wheel) {
        return true;
    }
    if (target.wheel !== undefined && t.wheel === target.wheel) {
        // slot channel with rotation/shake ranges of the same wheel
        return (
            (target.key === "colorWheel" || target.key === "goboWheel" || target.key === "prism") &&
            (cap.type === "WheelRotation" || cap.type === "WheelShake")
        );
    }
    return false;
}

function buildEntry(ctx: MapContext, channel: OflResolvedChannel, target: CapTarget, fine: number): CapabilityChannel | null {
    const caps = channel.capabilities;
    const positions =
        target.key === "pan" || target.key === "tilt"
            ? positionAngles(
                  ctx,
                  target.key,
                  caps.filter((c) => belongsTo(ctx, c, channel, target))
              )
            : null;
    let typed = caps.filter((c) => belongsTo(ctx, c, channel, target));
    if (typed.some((c) => !isKeywordCap(c))) {
        // keyword effects next to typed ranges are other functions ("Auto moving" next to a BeamPosition range)
        typed = typed.filter((c) => !isKeywordCap(c));
    }
    if (
        target.key === "shutter" &&
        ctx.hasStrobeSpeed &&
        !typed.some(
            (c) =>
                c.type === "StrobeSpeed" ||
                (c.type === "ShutterStrobe" && !["Open", "Closed"].includes(str(c as Rec, "shutterEffect") ?? "") && hasEntity(c as Rec, "speed"))
        )
    ) {
        // strobe effects without rates: the separate StrobeSpeed channel describes the strobe better
        return null;
    }
    const coverage = typed.reduce((sum, c) => sum + dmxRange(c)[1] - dmxRange(c)[0] + 1, 0);
    if (target.key === "colorMacro" && typed.length === 1 && coverage < MIN_SINGLE_RANGE_COVERAGE) {
        // a lone narrow preset on another function's channel (e.g. one color chase on a "Chases" channel)
        return null;
    }
    let typedIndex = 0;
    const raw = caps.map((cap) => (typed.includes(cap) ? typedSegment(ctx, target, cap, positions, typedIndex++) : foreignSegment(target.key, cap)));
    const { segments } = sanitizeSegments(raw);
    if (!segments.some((s) => s.kind !== "none")) {
        return null;
    }
    const entry: CapabilityChannel = {
        channel: channel.index,
        fine,
        segments,
        defaultValue: KEY_INFO[target.key].defaultValue,
        source: "auto",
    };
    if (target.wheel !== undefined) {
        entry.wheel = target.wheel;
    }
    return entry;
}

function isSlotKey(key: CapabilityKey): boolean {
    return key === "colorWheel" || key === "goboWheel" || key === "prism";
}

/**
 * Capabilities that rank below the R3 table: Effect/Generic map by keywords only (R14), and a StrobeSpeed channel
 * (strobe rate on its own channel) only provides the shutter when no shutter channel with rates exists.
 */
function isSecondaryCap(cap: Cap): boolean {
    return isKeywordCap(cap) || cap.type === "StrobeSpeed";
}

function isKeywordCap(cap: Cap): boolean {
    return cap.type === "Effect" || cap.type === "EffectParameter" || cap.type === "Generic";
}

function isPrismWithSpeed(cap: Cap): boolean {
    return cap.type === "Prism" && hasEntity(cap as Rec, "speed");
}

/**
 * Keys a channel offers, in capability order. `primary` keys come from the R3 table; `secondary` keys are only
 * used when no channel provides them as a primary key: R14 keyword matches of Effect/Generic capabilities, and a
 * prism channel with rotating ranges → prismRotation.
 * A wheel's slot channel folds that wheel's rotation ranges in instead of also offering the rotation key.
 */
function channelTargets(ctx: MapContext, channel: OflResolvedChannel): { primary: CapTarget[]; secondary: CapTarget[] } {
    const targets: CapTarget[] = [];
    const keywordTargets: CapTarget[] = [];
    const caps = channel.capabilities;
    for (const cap of caps) {
        const t = targetOf(ctx, cap, channel);
        if (t && !isSecondaryCap(cap) && !targets.some((x) => x.key === t.key)) {
            targets.push(t);
        }
    }
    for (const cap of caps) {
        const t = targetOf(ctx, cap, channel);
        if (t && isSecondaryCap(cap) && !targets.some((x) => x.key === t.key) && !keywordTargets.some((x) => x.key === t.key)) {
            keywordTargets.push(t);
        }
    }
    const slotWheels = new Set(targets.filter((t) => isSlotKey(t.key)).map((t) => t.wheel));
    const primary = targets.filter((t) => {
        if (t.wheel === undefined || !slotWheels.has(t.wheel)) {
            return true;
        }
        // WheelRotation of the slot channel's own wheel is folded into the slot entry (gobo-in-slot rotation is not).
        const fromSlotRotation = caps.some((c) => c.type === "WheelSlotRotation" && targetOf(ctx, c, channel)?.key === t.key);
        return fromSlotRotation || !(t.key === "colorWheelRotation" || t.key === "goboWheelRotation" || t.key === "prismRotation");
    });
    const secondary: CapTarget[] = [...keywordTargets];
    if (ctx.supported.has("prismRotation") && caps.some(isPrismWithSpeed)) {
        secondary.push({ key: "prismRotation" });
    }
    return { primary, secondary };
}

// ---------------------------------------------------------------------------------------------------------------
// Cells (FR-034, data-model.md §1 "Cells")
// ---------------------------------------------------------------------------------------------------------------

const CELL_FIELD_BY_COLOR: Record<string, Exclude<keyof CellMapping, "emitter" | "pixelKey">> = {
    red: "red",
    green: "green",
    blue: "blue",
    white: "white",
    "warm white": "white",
    "cold white": "white",
    amber: "amber",
    uv: "uv",
};

function pixelPositions(definition: OflFixture): Map<string, [number, number, number]> {
    const map = new Map<string, [number, number, number]>();
    const matrix = definition.matrix;
    if (matrix?.pixelKeys) {
        matrix.pixelKeys.forEach((plane, z) => plane.forEach((row, y) => row.forEach((key, x) => key !== null && map.set(key, [x, y, z]))));
    } else if (matrix?.pixelCount) {
        const [cx, cy, cz] = matrix.pixelCount;
        for (let z = 0; z < cz; z++) {
            for (let y = 0; y < cy; y++) {
                for (let x = 0; x < cx; x++) {
                    map.set(String(1 + x + y * cx + z * cx * cy), [x, y, z]);
                }
            }
        }
    }
    return map;
}

/** Pixel keys of the matrix channels in X, then Y, then Z order; groups and unknown keys keep their DMX order. */
function orderedPixelKeys(definition: OflFixture, channels: OflResolvedChannel[]): string[] {
    const keys: string[] = [];
    for (const ch of channels) {
        if (ch.pixelKey !== undefined && !keys.includes(ch.pixelKey)) {
            keys.push(ch.pixelKey);
        }
    }
    const positions = pixelPositions(definition);
    const order = (k: string) => {
        const p = positions.get(k);
        return p ? p[2] * 1e6 + p[1] * 1e3 + p[0] : Infinity;
    };
    return keys.map((k, i) => ({ k, i })).sort((a, b) => order(a.k) - order(b.k) || a.i - b.i).map((e) => e.k);
}

function buildCells(definition: OflFixture, channels: OflResolvedChannel[], model: FixtureAssetDefinition | null): CellMapping[] {
    const pixelKeys = orderedPixelKeys(definition, channels);
    if (pixelKeys.length === 0) {
        return [];
    }
    const emitters = (model?.fixture.emitters ?? [])
        .map((e) => e.id)
        .filter((id) => id.startsWith("cell-"))
        .sort(naturalCompare);
    const P = pixelKeys.length;
    const E = emitters.length;
    return pixelKeys.map((pixelKey, i) => {
        const cell: CellMapping = {
            emitter: E > 0 ? emitters[Math.floor((i * E) / P)] : `pixel:${pixelKey}`,
            pixelKey,
            dimmer: -1,
            red: -1,
            green: -1,
            blue: -1,
            white: -1,
            amber: -1,
            uv: -1,
        };
        for (const ch of channels) {
            if (ch.pixelKey !== pixelKey || ch.fineOf !== undefined || ch.ignored) {
                continue;
            }
            for (const cap of ch.capabilities) {
                const field =
                    cap.type === "Intensity" ? "dimmer" : cap.type === "ColorIntensity" ? CELL_FIELD_BY_COLOR[(str(cap as Rec, "color") ?? "").toLowerCase()] : undefined;
                if (field && cell[field] < 0) {
                    cell[field] = ch.index;
                    break;
                }
            }
        }
        return cell;
    });
}

// ---------------------------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------------------------

function lensOf(definition: OflFixture, mode: OflMode): [number, number] | null {
    const lens = mode.physical?.lens ?? definition.physical?.lens;
    const mm = lens?.degreesMinMax;
    return mm && Number.isFinite(mm[0]) && Number.isFinite(mm[1]) ? [mm[0], mm[1]] : null;
}

/** Slot key whose wheel a rotation key must share (the decoder samples one wheel per slot/rotation pair). */
const SLOT_KEY_OF: Partial<Record<CapabilityKey, CapabilityKey>> = {
    colorWheelRotation: "colorWheel",
    goboWheelRotation: "goboWheel",
    goboRotation: "goboWheel",
    prismRotation: "prism",
};

function wheelConsistent(mapping: CapabilityMapping, target: CapTarget): boolean {
    const slotKey = SLOT_KEY_OF[target.key];
    const slotWheel = slotKey ? mapping.channels[slotKey]?.wheel : undefined;
    return target.wheel === undefined || slotWheel === undefined || slotWheel === target.wheel;
}

const WHEEL_KEYS: CapabilityKey[] = ["colorWheel", "goboWheel", "prism", "colorWheelRotation", "goboWheelRotation", "goboRotation", "prismRotation"];

/**
 * Complete mapping of `mode` for `type` (research R3). Unsupported or ambiguous channels stay unmapped: the first
 * channel that offers a key wins. Matrix channels become cells (Generic Fixture). Types without cells fall back to
 * the first pixel's channels for keys no fixture-wide channel provides (e.g. a moving head whose colors are
 * per-head only).
 */
export function autoMapCapabilities(
    definition: OflFixture,
    mode: OflMode,
    type: VisualizationType,
    model: FixtureAssetDefinition | null
): CapabilityMapping {
    const supported = new Set(KEYS_BY_TYPE[type] ?? []);
    const wheelKinds = new Map<string, WheelKind>();
    for (const [name, wheel] of Object.entries(definition.wheels ?? {})) {
        const kind = wheelKindOf((wheel.slots ?? []) as OflWheelSlot[]);
        if (kind) {
            wheelKinds.set(name, kind);
        }
    }
    const channels = resolveModeChannels(definition, mode);
    const ctx: MapContext = {
        definition,
        mode,
        supported,
        model,
        wheelKinds,
        lens: lensOf(definition, mode),
        hasStrobeSpeed: channels.some((ch) => ch.pixelKey === undefined && ch.capabilities.some((c) => c.type === "StrobeSpeed")),
    };
    const mapping = emptyMapping();
    const hasCells = type === ("Generic Fixture" as VisualizationType);

    const fineOf = new Map<number, number>();
    for (const ch of channels) {
        if (ch.fineOf !== undefined && !fineOf.has(ch.fineOf)) {
            fineOf.set(ch.fineOf, ch.index);
        }
    }
    const isFunctional = (ch: OflResolvedChannel) => ch.key !== UNUSED_CHANNEL_KEY && ch.fineOf === undefined && !ch.ignored && ch.capabilities.length > 0;

    const assign = (list: OflResolvedChannel[]) => {
        const targets = list.map((ch) => ({ ch, ...channelTargets(ctx, ch) }));
        // Slot keys first, so rotation keys can be checked against the wheel their slot key uses.
        const passes: Array<["primary" | "secondary", (t: CapTarget) => boolean]> = [
            ["primary", (t) => isSlotKey(t.key)],
            ["primary", (t) => !isSlotKey(t.key)],
            ["secondary", () => true],
        ];
        for (const [pass, filter] of passes) {
            for (const item of targets) {
                for (const target of item[pass].filter(filter)) {
                    if (mapping.channels[target.key] || !wheelConsistent(mapping, target)) {
                        continue;
                    }
                    const entry = buildEntry(ctx, item.ch, target, fineOf.get(item.ch.index) ?? -1);
                    if (entry) {
                        mapping.channels[target.key] = entry;
                    }
                }
            }
        }
    };

    const functional = channels.filter(isFunctional);
    assign(functional.filter((ch) => ch.pixelKey === undefined));
    if (hasCells) {
        mapping.cells = buildCells(definition, channels, model);
    } else {
        const firstPixel = orderedPixelKeys(definition, functional)[0];
        if (firstPixel !== undefined) {
            assign(functional.filter((ch) => ch.pixelKey === firstPixel));
        }
    }

    if (WHEEL_KEYS.some((k) => supported.has(k))) {
        mapping.wheels = convertWheels(definition);
    }
    mapping.mappedMode = mode.name;
    mapping.mappedChannelCount = channels.length;
    return mapping;
}

// ---------------------------------------------------------------------------------------------------------------
// Dev console helper (T041)
// ---------------------------------------------------------------------------------------------------------------

const UNIT_LABEL: Partial<Record<string, string>> = { deg: "°", K: " K", rps: " rps" };

function fmt(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function describeSegment(segment: CapabilitySegment, unit: string): string {
    const range = `${segment.from}-${segment.to}`;
    switch (segment.kind) {
        case "linear":
            return `${range} ${fmt(segment.start)}…${fmt(segment.end)}${unit}`;
        case "angle":
            return `${range} ${fmt(segment.start)}…${fmt(segment.end)}°`;
        case "shutter":
            return segment.effect === "open" || segment.effect === "closed"
                ? `${range} ${segment.effect}`
                : `${range} ${segment.effect} ${fmt(segment.rateStart)}–${fmt(segment.rateEnd)} Hz`;
        case "wheelSlot":
            return `${range} slot ${segment.slotStart === segment.slotEnd ? fmt(segment.slotStart) : `${fmt(segment.slotStart)}…${fmt(segment.slotEnd)}`}`;
        case "rotation":
            return `${range} ${fmt(segment.speedStart)}…${fmt(segment.speedEnd)} rps`;
        case "color":
            return `${range} ${segment.colors.length > 0 ? segment.colors.join("/") : `${segment.temperature} K`}`;
        case "pattern":
            return `${range} ${segment.pattern}`;
        case "none":
            return `${range} –`;
    }
}

/**
 * One line per mapped key, e.g. `pan ← ch 1 (+fine 2), −270…270°`, plus wheels and cells. Channel numbers are
 * 1-based like DMX addresses.
 */
export function describeMapping(mapping: CapabilityMapping): string[] {
    const lines: string[] = [];
    for (const [key, entry] of Object.entries(mapping.channels) as Array<[CapabilityKey, CapabilityChannel | undefined]>) {
        if (!entry) {
            continue;
        }
        const unit = UNIT_LABEL[KEY_INFO[key]?.unit] ?? "";
        const target = entry.channel >= 0 ? `ch ${entry.channel + 1}${entry.fine >= 0 ? ` (+fine ${entry.fine + 1})` : ""}` : `unmapped (default ${fmt(entry.defaultValue)})`;
        const wheel = entry.wheel !== undefined ? ` [wheel "${entry.wheel}"]` : "";
        const segments = entry.segments;
        let detail: string;
        if (segments.length === 0) {
            detail = "default range";
        } else if (segments.length === 1 && segments[0].kind === "linear" && segments[0].from === 0 && segments[0].to === 255) {
            detail = `${fmt(segments[0].start).replace("-", "−")}…${fmt(segments[0].end).replace("-", "−")}${unit}`;
        } else {
            detail = segments.map((s) => describeSegment(s, unit)).join("; ");
        }
        lines.push(`${key} ← ${target}${wheel}, ${detail} (${entry.source})`);
    }
    for (const [name, wheel] of Object.entries(mapping.wheels)) {
        const slots = wheel.slots.map((s) => (s.type === "color" ? (s.colors.join("/") || `${s.temperature} K`) : s.type === "gobo" ? (s.image.startsWith("generic:") ? s.image : "svg") : s.type === "prism" ? `prism${s.facets}` : s.type));
        lines.push(`wheel "${name}" (${wheel.direction}): ${slots.join(", ")}`);
    }
    for (const cell of mapping.cells) {
        const parts = (["red", "green", "blue", "white", "amber", "uv", "dimmer"] as const)
            .filter((f) => cell[f] >= 0)
            .map((f) => `${f} ch ${cell[f] + 1}`);
        lines.push(`cell ${cell.pixelKey} → ${cell.emitter}: ${parts.join(", ") || "no channels"}`);
    }
    lines.push(`mode "${mapping.mappedMode ?? "—"}", ${mapping.mappedChannelCount} channels`);
    return lines;
}

if (import.meta.env?.DEV && typeof window !== "undefined") {
    (window as unknown as { __lmsDescribeMapping?: typeof describeMapping }).__lmsDescribeMapping = describeMapping;
}
