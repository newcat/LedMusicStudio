/**
 * Attribute encoder (feature 004, research R3): complete attribute set → DMX values of one fixture.
 * The exact inverse of feature 003's decoding (`capabilities/decode.ts`, `beamState.ts`, `cellState.ts`), so
 * `decode(encode(v)) ≈ v` (SC-002). Pure: no Vue/Pinia imports.
 *
 * Channels shared by several attributes go to the first writer. Attributes that were set explicitly (by a clip or
 * a per-fixture default) are encoded before those that only carry their built-in default.
 */

import { KEY_INFO } from "@/visualization/capabilities/keys";
import { kelvinToRgb } from "@/visualization/capabilities/colorMath";
import type {
    CapabilityChannel,
    CapabilityKey,
    CapabilityMapping,
    CapabilitySegment,
    WheelDefinition,
} from "@/visualization/capabilities/types";
import type { AttributeKey, AttributeValueMap, EncodeResult, FixtureProfile, Range, SlotInfo } from "./attributes";
import { closestColorSlot, hexToRgb, srgbToLinear } from "./color";

// ---------------------------------------------------------------------------------------------------------------
// Segment helpers (mirror decode.ts)
// ---------------------------------------------------------------------------------------------------------------

/** Span of a segment on the raw scale; 8-bit bounds ×257 for 16-bit entries, like `rawSpan` in decode.ts. */
function rawSpan(segment: CapabilitySegment, sixteenBit: boolean): { from: number; to: number } {
    return sixteenBit ? { from: segment.from * 257, to: segment.to * 257 } : { from: segment.from, to: segment.to };
}

function rawAt(entry: CapabilityChannel, segment: CapabilitySegment, t: number): number {
    const span = rawSpan(segment, entry.fine >= 0);
    return Math.round(span.from + Math.min(1, Math.max(0, t)) * (span.to - span.from));
}

function midpoint(entry: CapabilityChannel, segment: CapabilitySegment): number {
    return rawAt(entry, segment, 0.5);
}

function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}

function maxRaw(entry: CapabilityChannel): number {
    return entry.fine >= 0 ? 65535 : 255;
}

/** Inverse of a linear/angle (or rotation) value: the containing segment, else the closest one, clamped. */
function scalarRaw(entry: CapabilityChannel, v: number, key: CapabilityKey, kinds: ReadonlyArray<CapabilitySegment["kind"]>): number | null {
    if (entry.segments.length === 0) {
        const [s, e] = KEY_INFO[key].defaultRange ?? [0, 1];
        return Math.round((e === s ? 0 : clamp01((v - s) / (e - s))) * maxRaw(entry));
    }
    let best: CapabilitySegment | null = null;
    let bestStart = 0;
    let bestEnd = 0;
    let bestDistance = Infinity;
    let bestDegenerate = true;
    for (const segment of entry.segments) {
        let start: number;
        let end: number;
        if ((segment.kind === "linear" || segment.kind === "angle") && kinds.includes(segment.kind)) {
            start = segment.start;
            end = segment.end;
        } else if (segment.kind === "rotation" && kinds.includes("rotation")) {
            start = segment.speedStart;
            end = segment.speedEnd;
        } else {
            continue;
        }
        const lo = Math.min(start, end);
        const hi = Math.max(start, end);
        const distance = v < lo ? lo - v : v > hi ? v - hi : 0;
        const degenerate = start === end;
        // prefer the closest segment; among equally close ones a real range over a fixed value (e.g. the dimmer range
        // of a combined dimmer/strobe channel over the strobe ranges that decode as full dimmer)
        if (distance < bestDistance || (distance === bestDistance && bestDegenerate && !degenerate)) {
            best = segment;
            bestStart = start;
            bestEnd = end;
            bestDistance = distance;
            bestDegenerate = degenerate;
        }
    }
    if (!best) {
        return null;
    }
    const lo = Math.min(bestStart, bestEnd);
    const hi = Math.max(bestStart, bestEnd);
    const clamped = Math.min(hi, Math.max(lo, v));
    const t = bestStart === bestEnd ? 0.5 : (clamped - bestStart) / (bestEnd - bestStart);
    return rawAt(entry, best, t);
}

/** Inverse of a wheel slot: a fixed-slot segment's midpoint, else the exact position in a scrolling segment. */
function wheelRaw(entry: CapabilityChannel, slot: number): number | null {
    let scrolling: { segment: CapabilitySegment; t: number } | null = null;
    for (const segment of entry.segments) {
        if (segment.kind !== "wheelSlot") {
            continue;
        }
        if (segment.slotStart === slot && segment.slotEnd === slot) {
            return midpoint(entry, segment);
        }
        if (!scrolling && segment.slotStart !== segment.slotEnd) {
            const lo = Math.min(segment.slotStart, segment.slotEnd);
            const hi = Math.max(segment.slotStart, segment.slotEnd);
            if (slot >= lo && slot <= hi) {
                scrolling = { segment, t: (slot - segment.slotStart) / (segment.slotEnd - segment.slotStart) };
            }
        }
    }
    return scrolling ? rawAt(entry, scrolling.segment, scrolling.t) : null;
}

/** Inverse of a rotation speed (rps). 0 rps uses a segment containing 0, else a stop ("none") or indexed range. */
function rotationRaw(entry: CapabilityChannel, rps: number, key: CapabilityKey): number | null {
    if (entry.segments.length === 0) {
        return scalarRaw(entry, rps, key, ["rotation"]);
    }
    if (rps === 0) {
        const containing = entry.segments.find(
            (s) => s.kind === "rotation" && Math.min(s.speedStart, s.speedEnd) <= 0 && Math.max(s.speedStart, s.speedEnd) >= 0
        );
        if (!containing) {
            const stop = entry.segments.find((s) => s.kind === "none") ?? entry.segments.find((s) => s.kind === "angle");
            if (stop) {
                return midpoint(entry, stop);
            }
        }
    }
    return scalarRaw(entry, rps, key, ["rotation"]);
}

/** Range of the linear/angle segments of an entry (or the key's default range). */
export function linearRangeOf(entry: CapabilityChannel | undefined, key: CapabilityKey): Range {
    let min = Infinity;
    let max = -Infinity;
    for (const s of entry?.segments ?? []) {
        if (s.kind === "linear" || s.kind === "angle") {
            min = Math.min(min, s.start, s.end);
            max = Math.max(max, s.start, s.end);
        }
    }
    if (min > max) {
        const [a, b] = KEY_INFO[key].defaultRange ?? [0, 1];
        return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    return { min, max };
}

/** Range of the rotation segments of an entry (or the key's default range). */
export function rotationRangeOf(entry: CapabilityChannel | undefined, key: CapabilityKey): Range {
    let min = Infinity;
    let max = -Infinity;
    for (const s of entry?.segments ?? []) {
        if (s.kind === "rotation") {
            min = Math.min(min, s.speedStart, s.speedEnd);
            max = Math.max(max, s.speedStart, s.speedEnd);
        }
    }
    if (min > max) {
        const [a, b] = KEY_INFO[key].defaultRange ?? [-1, 1];
        return { min: Math.min(a, b, 0), max: Math.max(a, b, 0) };
    }
    return { min: Math.min(min, 0), max: Math.max(max, 0) };
}

// ---------------------------------------------------------------------------------------------------------------
// Slots (shared with profile.ts so slot numbers and encoding agree)
// ---------------------------------------------------------------------------------------------------------------

function wheelOf(mapping: CapabilityMapping, entry: CapabilityChannel | undefined): WheelDefinition | undefined {
    return entry?.wheel !== undefined ? mapping.wheels[entry.wheel] : undefined;
}

/** Slots of the wheel referenced by `key` (colorWheel, goboWheel, prism), numbered 1…n like the decoder. */
export function wheelSlotsOf(mapping: CapabilityMapping, key: "colorWheel" | "goboWheel" | "prism"): SlotInfo[] {
    const wheel = wheelOf(mapping, mapping.channels[key]);
    if (!wheel) {
        return [];
    }
    return wheel.slots.map((slot, i): SlotInfo => {
        const number = i + 1;
        switch (slot.type) {
            case "open":
                return { number, name: "Open", kind: "open", rgb: null };
            case "closed":
                return { number, name: "Closed", kind: "closed", rgb: null };
            case "color": {
                const rgb = slot.colors.length === 1 ? hexToRgb(slot.colors[0]) : null;
                return { number, name: slot.name, kind: "color", rgb };
            }
            case "gobo":
                return { number, name: slot.name, kind: "gobo", rgb: null };
            case "prism":
                return { number, name: slot.name, kind: "prism", rgb: null };
            case "frost":
                return { number, name: "Frost", kind: "other", rgb: null };
            case "iris":
                return { number, name: `Iris ${Math.round(slot.open * 100)} %`, kind: "other", rgb: null };
        }
        return { number, name: `Slot ${number}`, kind: "other", rgb: null };
    });
}

/** Prism without a wheel: every linear range with facets > 0 is one slot (1…n). */
function prismLinearSegments(entry: CapabilityChannel): CapabilitySegment[] {
    return entry.segments.filter((s) => s.kind === "linear" && Math.max(s.start, s.end) > 0);
}

export function prismSlotsOf(mapping: CapabilityMapping): SlotInfo[] {
    const entry = mapping.channels.prism;
    if (!entry) {
        return [];
    }
    if (wheelOf(mapping, entry)) {
        return wheelSlotsOf(mapping, "prism");
    }
    if (entry.segments.length === 0) {
        return [{ number: 1, name: "Prism", kind: "prism", rgb: null }];
    }
    return prismLinearSegments(entry).map((s, i) => {
        const facets = s.kind === "linear" ? Math.round(Math.max(s.start, s.end)) : 0;
        return { number: i + 1, name: facets >= 2 ? `Prism (${facets} facets)` : `Prism ${i + 1}`, kind: "prism", rgb: null };
    });
}

function macroSegments(entry: CapabilityChannel): CapabilitySegment[] {
    return entry.segments.filter((s) => s.kind === "color");
}

export function colorMacroSlotsOf(mapping: CapabilityMapping): SlotInfo[] {
    const entry = mapping.channels.colorMacro;
    if (!entry) {
        return [];
    }
    return macroSegments(entry).map((s, i) => {
        if (s.kind !== "color") {
            return { number: i + 1, name: `Macro ${i + 1}`, kind: "other", rgb: null };
        }
        const name = s.colors.length > 0 ? s.colors.join(" / ") : `${s.temperature ?? "?"} K`;
        const rgb = s.colors.length === 1 ? hexToRgb(s.colors[0]) : null;
        return { number: i + 1, name, kind: "color", rgb };
    });
}

// ---------------------------------------------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------------------------------------------

const ADDITIVE_EXTRA = ["amber", "uv", "lime", "indigo", "warmWhite", "coldWhite"] as const;

class Writer {
    public constructor(
        public readonly values: Uint8Array,
        public readonly writtenBy: Array<AttributeKey | null>
    ) {}

    private free(index: number): boolean {
        return Number.isInteger(index) && index >= 0 && index < this.values.length && this.writtenBy[index] === null;
    }

    public isMapped(entry: CapabilityChannel | undefined): entry is CapabilityChannel {
        return !!entry && Number.isInteger(entry.channel) && entry.channel >= 0 && entry.channel < this.values.length;
    }

    public isFree(entry: CapabilityChannel | undefined): entry is CapabilityChannel {
        return !!entry && this.free(entry.channel);
    }

    /** Writes a raw value (8- or 16-bit, by the entry) if the coarse channel is still free. */
    public entry(entry: CapabilityChannel | undefined, raw: number | null, key: AttributeKey): boolean {
        if (!entry || raw === null || !this.free(entry.channel)) {
            return false;
        }
        const r = Math.round(raw);
        if (entry.fine >= 0) {
            const v = Math.min(65535, Math.max(0, r));
            this.values[entry.channel] = v >> 8;
            this.writtenBy[entry.channel] = key;
            if (this.free(entry.fine)) {
                this.values[entry.fine] = v & 255;
                this.writtenBy[entry.fine] = key;
            }
        } else {
            this.values[entry.channel] = Math.min(255, Math.max(0, r));
            this.writtenBy[entry.channel] = key;
        }
        return true;
    }

    /** Plain 8-bit cell channel, value 0..1. */
    public index(index: number, value01: number, key: AttributeKey): void {
        if (this.free(index)) {
            this.values[index] = Math.round(clamp01(value01) * 255);
            this.writtenBy[index] = key;
        }
    }
}

type Step = "pan" | "tilt" | "panTiltSpeed" | "shutter" | "dimmer" | "color" | "colorMacro" | "goboWheel" | "goboRotation" | "prism" | "prismRotation" | "zoom" | "focus";

/** Order in which the steps take shared channels (shutter before dimmer: a strobe on a combined channel wins). */
const STEPS: readonly Step[] = ["pan", "tilt", "panTiltSpeed", "shutter", "dimmer", "color", "colorMacro", "goboWheel", "goboRotation", "prism", "prismRotation", "zoom", "focus"];

const STEP_KEYS: Record<Step, readonly AttributeKey[]> = {
    pan: ["pan"],
    tilt: ["tilt"],
    panTiltSpeed: ["panTiltSpeed"],
    shutter: ["shutter"],
    dimmer: ["dimmer", "shutter"],
    color: ["color", "colorWheel", "colorTemperature"],
    colorMacro: ["colorMacro"],
    goboWheel: ["goboWheel"],
    goboRotation: ["goboRotation"],
    prism: ["prism"],
    prismRotation: ["prismRotation"],
    zoom: ["zoom"],
    focus: ["focus"],
};

/** Whether a mapping can show the `closed` shutter state on its own (a closed shutter range). */
function hasClosedShutter(mapping: CapabilityMapping): boolean {
    return !!mapping.channels.shutter?.segments.some((s) => s.kind === "shutter" && s.effect === "closed");
}

/** Whether intensity is controlled by a real channel (fixture dimmer or cell dimmers). */
export function hasDimmerChannel(mapping: CapabilityMapping, channelCount: number): boolean {
    const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < channelCount;
    const dimmer = mapping.channels.dimmer;
    return (!!dimmer && inRange(dimmer.channel)) || mapping.cells.some((c) => inRange(c.dimmer));
}

/**
 * Encodes a complete attribute set (defaults already applied). `isSet(key)` tells which attributes come from a
 * clip or a per-fixture default; they take shared channels first (rule 4 of R3: an explicit colorWheel wins).
 * `out` is reused when given (no per-frame allocation, R12).
 */
export function encodeAttributes(
    profile: FixtureProfile,
    mapping: CapabilityMapping,
    values: AttributeValueMap,
    isSet: (key: AttributeKey) => boolean,
    out?: EncodeResult
): EncodeResult {
    const n = profile.channelCount;
    const result: EncodeResult =
        out && out.values.length === n ? out : { values: new Uint8Array(n), writtenBy: new Array<AttributeKey | null>(n).fill(null) };
    result.values.set(profile.channelDefaults.subarray(0, n));
    result.writtenBy.fill(null);
    const w = new Writer(result.values, result.writtenBy);
    const ch = mapping.channels;

    const closedWithoutChannel = values.shutter.mode === "closed" && !hasClosedShutter(mapping);
    const effectiveDimmer = closedWithoutChannel ? 0 : values.dimmer;
    const virtualDimmer = hasDimmerChannel(mapping, n) ? 1 : effectiveDimmer;

    const encodeStep = (step: Step) => {
        switch (step) {
            case "pan":
            case "tilt": {
                let v = values[step];
                if (profile.panTiltNormalized) {
                    const r = linearRangeOf(ch[step], step);
                    v = r.min + clamp01(v) * (r.max - r.min);
                }
                if (w.isMapped(ch[step])) {
                    w.entry(ch[step], scalarRaw(ch[step]!, v, step, ["linear", "angle"]), step);
                }
                break;
            }
            case "panTiltSpeed":
                // the mapping's panTiltSpeed is 0 = fast, 1 = slow; the attribute is 1 = fastest
                if (w.isMapped(ch.panTiltSpeed)) {
                    w.entry(ch.panTiltSpeed, scalarRaw(ch.panTiltSpeed, 1 - values.panTiltSpeed, "panTiltSpeed", ["linear"]), "panTiltSpeed");
                }
                break;
            case "shutter": {
                const entry = ch.shutter;
                if (!w.isMapped(entry) || entry.segments.length === 0) {
                    break;
                }
                const shutter = values.shutter;
                if (shutter.mode === "open" && ch.dimmer && ch.dimmer.channel === entry.channel) {
                    // combined dimmer/shutter channel: "open" is the dimmer range, written by the dimmer
                    break;
                }
                w.entry(entry, shutterRaw(entry, shutter.mode, shutter.rate), "shutter");
                break;
            }
            case "dimmer":
                if (w.isMapped(ch.dimmer)) {
                    w.entry(ch.dimmer, scalarRaw(ch.dimmer, effectiveDimmer, "dimmer", ["linear"]), closedWithoutChannel ? "shutter" : "dimmer");
                }
                break;
            case "color":
                encodeColor(w, profile, mapping, values, isSet, virtualDimmer, effectiveDimmer);
                break;
            case "colorMacro": {
                const entry = ch.colorMacro;
                if (!isSet("colorMacro") || values.colorMacro < 1 || !w.isMapped(entry)) {
                    break;
                }
                const segment = macroSegments(entry)[values.colorMacro - 1];
                if (segment) {
                    w.entry(entry, midpoint(entry, segment), "colorMacro");
                }
                break;
            }
            case "goboWheel":
                if (w.isMapped(ch.goboWheel)) {
                    w.entry(ch.goboWheel, wheelRaw(ch.goboWheel, values.goboWheel), "goboWheel");
                }
                break;
            case "goboRotation":
            case "prismRotation":
                if (w.isMapped(ch[step])) {
                    w.entry(ch[step], rotationRaw(ch[step]!, values[step], step), step);
                }
                break;
            case "prism":
                if (w.isMapped(ch.prism)) {
                    w.entry(ch.prism, prismRaw(mapping, ch.prism, values.prism), "prism");
                }
                break;
            case "zoom": {
                if (w.isMapped(ch.zoom)) {
                    const r = linearRangeOf(ch.zoom, "zoom");
                    w.entry(ch.zoom, scalarRaw(ch.zoom, r.min + clamp01(values.zoom) * (r.max - r.min), "zoom", ["linear"]), "zoom");
                }
                break;
            }
            case "focus":
                if (w.isMapped(ch.focus)) {
                    w.entry(ch.focus, scalarRaw(ch.focus, values.focus, "focus", ["linear"]), "focus");
                }
                break;
        }
    };

    const explicit = (step: Step) => STEP_KEYS[step].some((k) => isSet(k));
    for (const step of STEPS) {
        if (explicit(step)) {
            encodeStep(step);
        }
    }
    for (const step of STEPS) {
        if (!explicit(step)) {
            encodeStep(step);
        }
    }
    return result;
}

function shutterRaw(entry: CapabilityChannel, mode: "open" | "closed" | "strobe", rate: number): number | null {
    const shutters = entry.segments.filter((s): s is Extract<CapabilitySegment, { kind: "shutter" }> => s.kind === "shutter");
    if (mode !== "strobe") {
        const segment = shutters.find((s) => s.effect === mode);
        return segment ? midpoint(entry, segment) : null;
    }
    const strobes = shutters.filter((s) => s.effect === "strobe");
    if (strobes.length === 0) {
        // no strobe range: stay open
        const open = shutters.find((s) => s.effect === "open");
        return open ? midpoint(entry, open) : null;
    }
    let best = strobes[0];
    let bestDistance = Infinity;
    for (const s of strobes) {
        const lo = Math.min(s.rateStart, s.rateEnd);
        const hi = Math.max(s.rateStart, s.rateEnd);
        const d = rate < lo ? lo - rate : rate > hi ? rate - hi : 0;
        if (d < bestDistance) {
            best = s;
            bestDistance = d;
        }
    }
    const lo = Math.min(best.rateStart, best.rateEnd);
    const hi = Math.max(best.rateStart, best.rateEnd);
    const clamped = Math.min(hi, Math.max(lo, rate));
    const t = best.rateEnd === best.rateStart ? 0.5 : (clamped - best.rateStart) / (best.rateEnd - best.rateStart);
    return rawAt(entry, best, t);
}

function prismRaw(mapping: CapabilityMapping, entry: CapabilityChannel, prism: number): number | null {
    const wheel = wheelOf(mapping, entry);
    if (wheel) {
        if (prism >= 1) {
            return wheelRaw(entry, prism);
        }
        const open = wheel.slots.findIndex((s) => s.type === "open");
        const raw = open >= 0 ? wheelRaw(entry, open + 1) : null;
        if (raw !== null) {
            return raw;
        }
        const none = entry.segments.find((s) => s.kind === "none");
        return none ? midpoint(entry, none) : 0;
    }
    if (entry.segments.length === 0) {
        // decoder: any raw > 0 is "prism in"
        return prism > 0 ? maxRaw(entry) : 0;
    }
    if (prism >= 1) {
        const segment = prismLinearSegments(entry)[prism - 1];
        return segment ? midpoint(entry, segment) : null;
    }
    const off = entry.segments.find((s) => s.kind === "none") ?? entry.segments.find((s) => s.kind === "linear" && Math.max(s.start, s.end) <= 0);
    return off ? midpoint(entry, off) : 0;
}

/**
 * Color (R3, steps 1–5): additive mix with white extraction, CMY, closest wheel slot for wheel-only fixtures,
 * explicit colorWheel, cells. Channel values are linear light (the decoder adds primaries in linear RGB).
 * Fixtures without a dimmer channel get a virtual dimmer: the additive values are scaled by the dimmer.
 */
function encodeColor(
    w: Writer,
    profile: FixtureProfile,
    mapping: CapabilityMapping,
    values: AttributeValueMap,
    isSet: (key: AttributeKey) => boolean,
    virtualDimmer: number,
    effectiveDimmer: number
): void {
    const ch = mapping.channels;
    let r = srgbToLinear(values.color[0]);
    let g = srgbToLinear(values.color[1]);
    let b = srgbToLinear(values.color[2]);

    const temperatureMapped = w.isMapped(ch.colorTemperature);
    if (temperatureMapped) {
        w.entry(ch.colorTemperature, scalarRaw(ch.colorTemperature!, values.colorTemperature, "colorTemperature", ["linear"]), "colorTemperature");
    } else if (isSet("colorTemperature")) {
        // RGB-only fixtures: tint the mix with the same Kelvin approximation the decoder uses
        const k = kelvinToRgb(values.colorTemperature);
        const max = Math.max(1, k.r, k.g, k.b);
        r *= k.r / max;
        g *= k.g / max;
        b *= k.b / max;
    }

    const additive = w.isMapped(ch.red) || w.isMapped(ch.green) || w.isMapped(ch.blue);
    const cmy = w.isMapped(ch.cyan) || w.isMapped(ch.magenta) || w.isMapped(ch.yellow);
    const cells = !additive && mapping.cells.length > 0;

    if (additive) {
        let white = 0;
        if (w.isMapped(ch.white)) {
            white = Math.min(r, g, b);
            r -= white;
            g -= white;
            b -= white;
        }
        w.entry(ch.red, w.isMapped(ch.red) ? scalarRaw(ch.red!, r * virtualDimmer, "red", ["linear"]) : null, "color");
        w.entry(ch.green, w.isMapped(ch.green) ? scalarRaw(ch.green!, g * virtualDimmer, "green", ["linear"]) : null, "color");
        w.entry(ch.blue, w.isMapped(ch.blue) ? scalarRaw(ch.blue!, b * virtualDimmer, "blue", ["linear"]) : null, "color");
        if (w.isMapped(ch.white)) {
            w.entry(ch.white, scalarRaw(ch.white, white * virtualDimmer, "white", ["linear"]), "color");
        }
        for (const key of ADDITIVE_EXTRA) {
            if (w.isMapped(ch[key])) {
                w.entry(ch[key], scalarRaw(ch[key]!, 0, key, ["linear"]), "color");
            }
        }
    } else if (!cells) {
        // fixtures with only white emitters: warm/cold white follow the color temperature, white gets the brightness
        const warm = w.isMapped(ch.warmWhite);
        const cold = w.isMapped(ch.coldWhite);
        if (warm || cold) {
            const t = warm && cold ? clamp01((values.colorTemperature - 3000) / (6500 - 3000)) : 1;
            if (cold) {
                w.entry(ch.coldWhite, scalarRaw(ch.coldWhite!, (warm ? t : 1) * virtualDimmer, "coldWhite", ["linear"]), "colorTemperature");
            }
            if (warm) {
                w.entry(ch.warmWhite, scalarRaw(ch.warmWhite!, (cold ? 1 - t : 1) * virtualDimmer, "warmWhite", ["linear"]), "colorTemperature");
            }
        }
        if (w.isMapped(ch.white)) {
            w.entry(ch.white, scalarRaw(ch.white, Math.max(r, g, b) * virtualDimmer, "white", ["linear"]), "color");
        }
    }

    if (cmy) {
        const set = (key: "cyan" | "magenta" | "yellow", v: number) => {
            if (w.isMapped(ch[key])) {
                w.entry(ch[key], scalarRaw(ch[key]!, additive ? 0 : clamp01(1 - v), key, ["linear"]), "color");
            }
        };
        set("cyan", r);
        set("magenta", g);
        set("yellow", b);
    }

    if (cells) {
        const fixtureDimmer = w.isMapped(ch.dimmer);
        for (const cell of mapping.cells) {
            let cr = r;
            let cg = g;
            let cb = b;
            let cw = 0;
            if (cell.white >= 0) {
                cw = Math.min(cr, cg, cb);
                cr -= cw;
                cg -= cw;
                cb -= cw;
            }
            // cells with their own dimmer: it carries the intensity; otherwise the color is scaled (virtual dimmer)
            const scale = cell.dimmer >= 0 || fixtureDimmer ? 1 : effectiveDimmer;
            w.index(cell.red, cr * scale, "color");
            w.index(cell.green, cg * scale, "color");
            w.index(cell.blue, cb * scale, "color");
            w.index(cell.white, cw * scale, "color");
            w.index(cell.amber, 0, "color");
            w.index(cell.uv, 0, "color");
            w.index(cell.dimmer, fixtureDimmer ? 1 : effectiveDimmer, "dimmer");
        }
    }

    // color wheel: explicit slot (or "open") on mixing fixtures, closest slot on wheel-only fixtures
    const wheelEntry = ch.colorWheel;
    if (w.isMapped(wheelEntry) && w.isFree(wheelEntry)) {
        const mixing = additive || cmy || cells;
        let slot = values.colorWheel;
        let writer: AttributeKey = "colorWheel";
        if (!mixing && !isSet("colorWheel")) {
            const closest = closestColorSlot(profile.slots.colorWheel ?? [], values.color);
            if (closest > 0) {
                slot = closest;
                writer = "color";
            }
        }
        w.entry(wheelEntry, wheelRaw(wheelEntry, slot), writer);
    }
}
