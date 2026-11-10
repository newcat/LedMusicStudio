/**
 * Beam fixture decoding (feature 003, research R4–R6): raw DMX values + capability mapping → `BeamState`.
 * One `BeamDecoder` per renderer: it keeps the per-fixture state that decoding needs (held values, wheel
 * positions, strobe phase, rotation angles). Per-frame logic only: no Vue/Pinia imports.
 */

import * as THREE from "three";
import { ADDITIVE_PRIMARIES, hexToLinear, kelvinToRgb } from "./colorMath";
import { decodeScalar, findSegment, readDmx, segmentPosition } from "./decode";
import { WheelFollower } from "./movement";
import { ShutterGate } from "./strobe";
import type { CapabilityChannel, CapabilityKey, CapabilityMapping, CapabilitySegment, WheelDefinition, WheelSlot } from "./types";
import type { FrameContext } from "@/visualization/fixtureVisualizations/base.renderer";
import type { BeamVisualizationConfig } from "@/visualization/fixtureVisualizations/beam/types";

export interface BeamState {
    /** Targets in degrees (before realistic movement). */
    pan: number;
    tilt: number;
    /** 0..1 final intensity incl. dimmer, shutter/strobe gate and closed wheel slots. */
    intensity: number;
    /**
     * Linear RGB of the mix, wheel, temperature (not multiplied by intensity). With a split slot/macro this is the
     * first half; the surface light uses the 50/50 average of `color` and `splitColor`.
     */
    color: THREE.Color;
    /** Second color (second half) of a split wheel slot or color macro, null otherwise. */
    splitColor: THREE.Color | null;
    /** Full beam angle in degrees (target, before smoothing), iris applied. */
    beamAngle: number;
    /** Edge softness 0..1: `config.softness`, raised by 0.5 while a frost slot is in the beam. */
    softness: number;
    /** Gobo image of the current slot (SVG or "generic:<n>"), null = open. */
    gobo: string | null;
    /** Next slot's image and blend factor while the wheel is between slots. */
    goboNext: string | null;
    goboBlend: number;
    /** Radians (same unit as `SpotLightParams.goboRotation`). */
    goboRotation: number;
    /** 0 = no prism. */
    prismFacets: number;
    /** Radians. */
    prismRotation: number;
}

const ADDITIVE_KEYS = [
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
] as const satisfies ReadonlyArray<keyof typeof ADDITIVE_PRIMARIES & CapabilityKey>;

/** Facets used when the prism is in but no wheel slot gives a facet count. */
const DEFAULT_PRISM_FACETS = 3;
/** Frost adds this much edge softness. */
const FROST_SOFTNESS = 0.5;
/** Smallest iris opening applied to the beam angle (keeps the cone from collapsing). */
const MIN_IRIS = 0.05;
const TWO_PI = Math.PI * 2;
const DEG2RAD = Math.PI / 180;

function isMapped(entry: CapabilityChannel | undefined, values: Uint8Array): entry is CapabilityChannel {
    return !!entry && readDmx(entry, values) !== null;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function wrapAngle(rad: number): number {
    return ((rad % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Wheel slot of a 0-based index, wrapping around the wheel. */
function slotAt(wheel: WheelDefinition, index: number): WheelSlot | undefined {
    const n = wheel.slots.length;
    return n === 0 ? undefined : wheel.slots[((index % n) + n) % n];
}

function isSplit(slot: WheelSlot | undefined): boolean {
    return slot?.type === "color" && slot.colors.length === 2;
}

/**
 * Multiplicative color of a wheel slot: color/temperature filters; every other slot passes white.
 * For a split slot, `second` picks its second color (else the first); other slots ignore `second`.
 */
function slotColor(slot: WheelSlot | undefined, out: THREE.Color, second: boolean): THREE.Color {
    if (slot?.type === "color") {
        if (slot.colors.length > 0) {
            return hexToLinear(slot.colors[second && slot.colors.length > 1 ? 1 : 0], out);
        }
        if (slot.temperature !== null) {
            return kelvinToRgb(slot.temperature, out);
        }
    }
    return out.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
}

/** 0 while a closed slot is in the beam, blended while the wheel moves between slots. */
function slotGate({ a, b, f }: WheelSample): number {
    return lerp(a?.type === "closed" ? 0 : 1, b?.type === "closed" ? 0 : 1, f);
}

function slotFrost({ a, b, f }: WheelSample): number {
    return lerp(a?.type === "frost" ? 1 : 0, b?.type === "frost" ? 1 : 0, f);
}

function slotIris({ a, b, f }: WheelSample): number {
    return lerp(a?.type === "iris" ? a.open : 1, b?.type === "iris" ? b.open : 1, f);
}

/** Per-wheel state: follower and the held mode of the slot channel. */
interface WheelTrack {
    follower: WheelFollower;
    slotCount: number;
    /** Held target (0-based slot position) from the last matching wheelSlot segment. */
    target: number;
    /** Held rotation speed (rps) from the last matching rotation segment of the slot channel; 0 = indexed. */
    slotChannelRps: number;
    /** Held speed of the separate rotation channel. */
    rotationRps: number;
    initialized: boolean;
}

/** Rotation of a gobo or prism: continuous (rps) or indexed (angle). */
interface SpinTrack {
    angle: number;
    rps: number;
}

/** Wheel position split into the two neighbouring slots and the blend factor. */
interface WheelSample {
    wheel: WheelDefinition;
    a: WheelSlot | undefined;
    b: WheelSlot | undefined;
    f: number;
}

export class BeamDecoder {
    private readonly gate = new ShutterGate();
    private readonly wheels = new Map<string, WheelTrack>();
    private readonly held = new Map<CapabilityKey, number>();
    private readonly goboSpin: SpinTrack = { angle: 0, rps: 0 };
    private readonly prismSpin: SpinTrack = { angle: 0, rps: 0 };
    private shutterSegment: CapabilitySegment | null = null;
    private macroSegment: CapabilitySegment | null = null;
    private prismFacets = 0;

    private readonly state: BeamState = {
        pan: 0,
        tilt: 0,
        intensity: 1,
        color: new THREE.Color(1, 1, 1),
        splitColor: null,
        beamAngle: 15,
        softness: 0,
        gobo: null,
        goboNext: null,
        goboBlend: 0,
        goboRotation: 0,
        prismFacets: 0,
        prismRotation: 0,
    };
    private readonly split = new THREE.Color();
    private readonly tmp = new THREE.Color();
    private readonly tmp2 = new THREE.Color();

    /**
     * Decodes one frame. The returned object (and its colors) is reused by the next call: copy what must persist.
     */
    decode(mapping: CapabilityMapping, values: Uint8Array, frame: FrameContext, config: BeamVisualizationConfig): BeamState {
        const ch = mapping.channels;
        const s = this.state;
        const instant = config.movement.mode === "instant";

        // Position targets (16-bit when fine is mapped).
        s.pan = this.scalar("pan", ch.pan, values, 0);
        s.tilt = this.scalar("tilt", ch.tilt, values, 0);

        // 1. Additive mix; white when no additive key is mapped (FR-003).
        const color = s.color.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace);
        let anyAdditive = false;
        for (const key of ADDITIVE_KEYS) {
            const entry = ch[key];
            if (!isMapped(entry, values)) {
                continue;
            }
            anyAdditive = true;
            const v = Math.max(0, this.scalar(key, entry, values, 0));
            const p = ADDITIVE_PRIMARIES[key];
            color.r += p.r * v;
            color.g += p.g * v;
            color.b += p.b * v;
        }
        if (!anyAdditive) {
            color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
        }

        // 2. Subtractive CMY.
        const c = this.clamped01("cyan", ch.cyan, values);
        const m = this.clamped01("magenta", ch.magenta, values);
        const y = this.clamped01("yellow", ch.yellow, values);
        color.r *= 1 - c;
        color.g *= 1 - m;
        color.b *= 1 - y;

        // 3. Color wheel (also carries frost/iris/closed slots).
        let wheelGate = 1;
        let frost = 0;
        let iris = 1;
        let splitColor: THREE.Color | null = null;
        const colorWheel = this.sampleWheel(mapping, ch.colorWheel, ch.colorWheelRotation, values, frame.dt, instant);
        if (colorWheel) {
            const { a, b, f } = colorWheel;
            if (isSplit(a) || isSplit(b)) {
                // Second half of a split slot (the other neighbour contributes its plain color).
                const s1 = slotColor(a, this.tmp, true);
                const s2 = slotColor(b, this.tmp2, true);
                splitColor = this.split.setRGB(
                    color.r * lerp(s1.r, s2.r, f),
                    color.g * lerp(s1.g, s2.g, f),
                    color.b * lerp(s1.b, s2.b, f),
                    THREE.LinearSRGBColorSpace
                );
            }
            const ca = slotColor(a, this.tmp, false);
            const cb = slotColor(b, this.tmp2, false);
            color.r *= lerp(ca.r, cb.r, f);
            color.g *= lerp(ca.g, cb.g, f);
            color.b *= lerp(ca.b, cb.b, f);
            wheelGate *= slotGate(colorWheel);
            frost += slotFrost(colorWheel);
            iris *= slotIris(colorWheel);
        }

        // 4. Color temperature.
        if (isMapped(ch.colorTemperature, values)) {
            const k = kelvinToRgb(this.scalar("colorTemperature", ch.colorTemperature, values, 6500), this.tmp);
            color.multiply(k);
            splitColor?.multiply(k);
        }

        // 5. Color macro replaces the mix.
        if (isMapped(ch.colorMacro, values)) {
            const raw = readDmx(ch.colorMacro, values)!;
            const segment = findSegment(ch.colorMacro, raw);
            if (segment) {
                this.macroSegment = segment;
            }
            const macro = this.macroSegment;
            if (macro?.kind === "color") {
                if (macro.temperature !== null && macro.colors.length === 0) {
                    kelvinToRgb(macro.temperature, color);
                    splitColor = null;
                } else if (macro.colors.length > 0) {
                    hexToLinear(macro.colors[0], color);
                    splitColor = macro.colors.length > 1 ? hexToLinear(macro.colors[1], this.split) : null;
                }
            }
        } else {
            this.macroSegment = null;
        }
        s.splitColor = splitColor;

        // Gobo wheel.
        const goboWheel = this.sampleWheel(mapping, ch.goboWheel, ch.goboWheelRotation, values, frame.dt, instant);
        if (goboWheel) {
            const { a, b, f } = goboWheel;
            s.gobo = a?.type === "gobo" ? a.image : null;
            s.goboNext = f > 0 && b?.type === "gobo" ? b.image : null;
            s.goboBlend = f;
            wheelGate *= slotGate(goboWheel);
            frost += slotFrost(goboWheel);
            iris *= slotIris(goboWheel);
        } else {
            s.gobo = null;
            s.goboNext = null;
            s.goboBlend = 0;
        }

        // Zoom, iris, frost.
        const zoom = isMapped(ch.zoom, values)
            ? this.scalar("zoom", ch.zoom, values, config.defaultBeamAngle)
            : config.defaultBeamAngle;
        s.beamAngle = Math.max(0, zoom) * Math.max(MIN_IRIS, Math.min(1, iris));
        s.softness = Math.min(1, Math.max(0, config.softness + FROST_SOFTNESS * Math.min(1, frost)));

        // Prism and rotations.
        s.prismFacets = this.decodePrism(mapping, ch.prism, values);
        s.goboRotation = this.spin(this.goboSpin, ch.goboRotation, values, frame.dt);
        s.prismRotation = this.spin(this.prismSpin, ch.prismRotation, values, frame.dt);

        // 6. Intensity = dimmer × shutter gate (× closed wheel slots).
        const dimmer = Math.min(1, Math.max(0, this.scalar("dimmer", ch.dimmer, values, 1)));
        s.intensity = dimmer * this.shutter(ch.shutter, values, frame) * wheelGate;

        return s;
    }

    /** decodeScalar with hold: unmatched raws keep the previous value of the key. */
    private scalar(key: CapabilityKey, entry: CapabilityChannel | undefined, values: Uint8Array, initial: number): number {
        const prev = this.held.get(key) ?? (entry && entry.channel < 0 ? entry.defaultValue : initial);
        const v = decodeScalar(entry, values, prev, key);
        this.held.set(key, v);
        return v;
    }

    private clamped01(key: CapabilityKey, entry: CapabilityChannel | undefined, values: Uint8Array): number {
        if (!isMapped(entry, values)) {
            return 0;
        }
        return Math.min(1, Math.max(0, this.scalar(key, entry, values, 0)));
    }

    private shutter(entry: CapabilityChannel | undefined, values: Uint8Array, frame: FrameContext): number {
        if (!entry) {
            return this.gate.update(null, 0, frame);
        }
        const raw = readDmx(entry, values);
        if (raw === null) {
            this.gate.update(null, 0, frame);
            return Math.min(1, Math.max(0, entry.defaultValue));
        }
        if (entry.segments.length === 0) {
            return this.gate.update(null, 0, frame);
        }
        const segment = findSegment(entry, raw);
        if (segment) {
            this.shutterSegment = segment;
        }
        const held = this.shutterSegment;
        // ShutterGate expects the raw value in 8-bit segment units.
        const segmentRaw = entry.fine >= 0 ? raw / 257 : raw;
        return this.gate.update(held?.kind === "shutter" ? held : null, segmentRaw, frame);
    }

    /**
     * Advances the wheel referenced by the slot channel (or the rotation channel) and samples it.
     * Returns null when no wheel is referenced.
     */
    private sampleWheel(
        mapping: CapabilityMapping,
        slotEntry: CapabilityChannel | undefined,
        rotationEntry: CapabilityChannel | undefined,
        values: Uint8Array,
        dt: number,
        instant: boolean
    ): WheelSample | null {
        const name = slotEntry?.wheel ?? rotationEntry?.wheel;
        const wheel = name !== undefined ? mapping.wheels[name] : undefined;
        if (name === undefined || !wheel || wheel.slots.length === 0) {
            return null;
        }
        const n = wheel.slots.length;
        let track = this.wheels.get(name);
        if (!track || track.slotCount !== n) {
            track = {
                follower: new WheelFollower(n),
                slotCount: n,
                target: 0,
                slotChannelRps: 0,
                rotationRps: 0,
                initialized: false,
            };
            this.wheels.set(name, track);
        }

        // Slot channel: indexed position, or rotation segments on the same channel.
        if (slotEntry) {
            const raw = readDmx(slotEntry, values);
            if (raw === null) {
                track.target = Math.max(1, slotEntry.defaultValue) - 1;
                track.slotChannelRps = 0;
            } else {
                const segment = findSegment(slotEntry, raw);
                if (segment?.kind === "wheelSlot") {
                    track.target = lerp(segment.slotStart, segment.slotEnd, segmentPosition(slotEntry, segment, raw)) - 1;
                    track.slotChannelRps = 0;
                } else if (segment?.kind === "rotation") {
                    track.slotChannelRps = lerp(segment.speedStart, segment.speedEnd, segmentPosition(slotEntry, segment, raw));
                }
            }
        }

        // Separate rotation channel.
        if (rotationEntry) {
            const raw = readDmx(rotationEntry, values);
            if (raw === null) {
                track.rotationRps = 0;
            } else {
                const segment = findSegment(rotationEntry, raw);
                if (segment?.kind === "rotation") {
                    track.rotationRps = lerp(segment.speedStart, segment.speedEnd, segmentPosition(rotationEntry, segment, raw));
                } else if (segment) {
                    track.rotationRps = 0;
                }
            }
        }

        const rps = track.rotationRps !== 0 ? track.rotationRps : track.slotChannelRps;
        const follower = track.follower;
        if (rps !== 0) {
            const sign = wheel.direction === "CCW" ? -1 : 1;
            follower.advance(sign * rps * n * dt);
        } else if (!track.initialized || instant) {
            follower.snap(track.target);
        } else {
            follower.setTarget(track.target);
            follower.update(dt);
        }
        track.initialized = true;

        const pos = follower.position;
        const i = Math.floor(pos);
        const f = pos - i < 1e-4 ? 0 : pos - i;
        return { wheel, a: slotAt(wheel, i), b: slotAt(wheel, i + 1), f };
    }

    private decodePrism(mapping: CapabilityMapping, entry: CapabilityChannel | undefined, values: Uint8Array): number {
        if (!entry) {
            this.prismFacets = 0;
            return 0;
        }
        const raw = readDmx(entry, values);
        if (raw === null) {
            this.prismFacets = Math.max(0, Math.round(entry.defaultValue));
            return this.prismFacets;
        }
        if (entry.segments.length === 0) {
            this.prismFacets = raw > 0 ? DEFAULT_PRISM_FACETS : 0;
            return this.prismFacets;
        }
        const segment = findSegment(entry, raw);
        if (!segment) {
            return this.prismFacets;
        }
        const t = segmentPosition(entry, segment, raw);
        if (segment.kind === "wheelSlot") {
            const wheel = entry.wheel !== undefined ? mapping.wheels[entry.wheel] : undefined;
            const slotNumber = Math.round(lerp(segment.slotStart, segment.slotEnd, t));
            if (wheel) {
                const slot = slotAt(wheel, slotNumber - 1);
                this.prismFacets = slot?.type === "prism" ? slot.facets : 0;
            } else {
                this.prismFacets = slotNumber > 1 ? DEFAULT_PRISM_FACETS : 0;
            }
        } else if (segment.kind === "linear") {
            const v = lerp(segment.start, segment.end, t);
            this.prismFacets = v <= 0 ? 0 : v >= 2 ? Math.round(v) : DEFAULT_PRISM_FACETS;
        } else if (segment.kind === "none") {
            this.prismFacets = 0;
        } else {
            this.prismFacets = DEFAULT_PRISM_FACETS;
        }
        return this.prismFacets;
    }

    /** Rotation segments integrate the angle with dt; angle segments set it directly. Returns radians. */
    private spin(track: SpinTrack, entry: CapabilityChannel | undefined, values: Uint8Array, dt: number): number {
        const raw = entry ? readDmx(entry, values) : null;
        if (!entry || raw === null) {
            track.rps = entry ? entry.defaultValue : 0;
        } else if (entry.segments.length === 0) {
            track.rps = decodeScalar(entry, values, track.rps, "goboRotation");
        } else {
            const segment = findSegment(entry, raw);
            if (segment?.kind === "rotation") {
                track.rps = lerp(segment.speedStart, segment.speedEnd, segmentPosition(entry, segment, raw));
            } else if (segment?.kind === "angle") {
                track.rps = 0;
                track.angle = wrapAngle(lerp(segment.start, segment.end, segmentPosition(entry, segment, raw)) * DEG2RAD);
            } else if (segment) {
                track.rps = 0;
            }
        }
        if (track.rps !== 0 && dt > 0) {
            track.angle = wrapAngle(track.angle + track.rps * TWO_PI * dt);
        }
        return track.angle;
    }
}
