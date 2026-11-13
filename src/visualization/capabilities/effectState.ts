/**
 * Special-effect decoding (feature 003, research R14, contracts/renderer-api.ts `EffectState`): raw DMX values +
 * capability mapping + effect options → `EffectState`. Per-frame logic only: no Vue/Pinia imports.
 *
 * Holds: values that a DMX value outside every segment cannot decode keep their previous value (`prev` for the
 * effect's own state, a per-mapping `LaserHold` for values that are not part of the state, e.g. the dimmer).
 */

import * as THREE from "three";
import { hexToLinear, kelvinToRgb } from "./colorMath";
import { decodeScalar, findSegment, readDmx } from "./decode";
import { KEY_INFO } from "./keys";
import { ShutterGate } from "./strobe";
import type { CapabilityChannel, CapabilityKey, CapabilityMapping, LaserPattern } from "./types";
import type { FrameContext } from "@/visualization/fixtureVisualizations/base.renderer";
import type {
    EffectVisualizationConfig,
    FlameOptions,
    JetOptions,
    LaserOptions,
    SparkOptions,
} from "@/visualization/fixtureVisualizations/effects/types";

export type EffectState =
    | {
          kind: "laser";
          on: boolean;
          intensity: number;
          color: THREE.Color;
          pattern: LaserPattern;
          beams: number;
          size: number;
          /** Radians, integrated from `laserRotation` over `frame.dt`. */
          rotation: number;
          x: number;
          y: number;
      }
    | { kind: "flame" | "co2" | "spark"; on: boolean; height: number }
    | { kind: "fog"; output: number };

export type LaserEffectState = Extract<EffectState, { kind: "laser" }>;
export type EffectOptions = EffectVisualizationConfig["options"];
export type EffectKind = EffectOptions["kind"];
type HeightOptions = FlameOptions | JetOptions | SparkOptions;

/** Trigger is on at or above half of the decoded range, i.e. DMX ≥ 128 for the default 0…255 range (R14). */
const TRIGGER_THRESHOLD = 0.5;
const TWO_PI = Math.PI * 2;

/** Laser values that are not part of `LaserEffectState`, kept per mapping between frames. */
interface LaserHold {
    gate: ShutterGate;
    dimmer: number;
    rps: number;
}

const laserHolds = new WeakMap<CapabilityMapping, LaserHold>();

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number): number {
    return Math.min(1, Math.max(-1, value));
}

function wrapAngle(rad: number): number {
    return ((rad % TWO_PI) + TWO_PI) % TWO_PI;
}

function isMapped(entry: CapabilityChannel | undefined, values: Uint8Array): entry is CapabilityChannel {
    return !!entry && readDmx(entry, values) !== null;
}

/**
 * Scalar of a key: no entry → the key's default (KEY_INFO, FR-003); mapped → decoded, holding `held` (or the
 * default) while the raw value matches no segment.
 */
function scalarOf(
    key: CapabilityKey,
    entry: CapabilityChannel | undefined,
    values: Uint8Array,
    held: number | undefined
): number {
    if (!entry) {
        return KEY_INFO[key].defaultValue;
    }
    return decodeScalar(entry, values, held ?? KEY_INFO[key].defaultValue, key);
}

/**
 * Shutter gate 0..1 of the effect (same rules as the beam decoder): unmapped → open, a closed or unmatched raw
 * value follows `ShutterGate`, a mapped channel without segments is open.
 */
function shutterGate(
    entry: CapabilityChannel | undefined,
    values: Uint8Array,
    frame: FrameContext,
    gate: ShutterGate
): number {
    if (!entry) {
        return gate.update(null, 0, frame);
    }
    const raw = readDmx(entry, values);
    if (raw === null) {
        gate.update(null, 0, frame);
        return clamp01(entry.defaultValue);
    }
    if (entry.segments.length === 0) {
        return gate.update(null, 0, frame);
    }
    const segment = findSegment(entry, raw);
    // ShutterGate expects the raw value in 8-bit segment units.
    const segmentRaw = entry.fine >= 0 ? raw / 257 : raw;
    return gate.update(segment?.kind === "shutter" ? segment : null, segmentRaw, frame);
}

/** Laser color: RGB channels, else a color macro, else the option color (R14). */
function laserColor(
    ch: CapabilityMapping["channels"],
    values: Uint8Array,
    options: LaserOptions,
    prev: LaserEffectState | null
): THREE.Color {
    if ([ch.red, ch.green, ch.blue].some((entry) => isMapped(entry, values))) {
        const r = clamp01(scalarOf("red", ch.red, values, undefined));
        const g = clamp01(scalarOf("green", ch.green, values, undefined));
        const b = clamp01(scalarOf("blue", ch.blue, values, undefined));
        return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
    }
    if (ch.colorMacro && isMapped(ch.colorMacro, values)) {
        const raw = readDmx(ch.colorMacro, values);
        const segment = raw === null ? null : findSegment(ch.colorMacro, raw);
        if (segment?.kind === "color") {
            if (segment.colors.length > 0) {
                return hexToLinear(segment.colors[0]);
            }
            if (segment.temperature !== null) {
                return kelvinToRgb(segment.temperature);
            }
        }
        // Unmatched or non-color segment: hold the previous color.
        return prev?.color ?? hexToLinear(options.color);
    }
    return hexToLinear(options.color);
}

function decodeLaser(
    mapping: CapabilityMapping,
    values: Uint8Array,
    options: LaserOptions,
    frame: FrameContext,
    prev: LaserEffectState | null
): LaserEffectState {
    const ch = mapping.channels;
    let hold = laserHolds.get(mapping);
    if (!hold) {
        hold = { gate: new ShutterGate(), dimmer: KEY_INFO.dimmer.defaultValue, rps: KEY_INFO.laserRotation.defaultValue };
        laserHolds.set(mapping, hold);
    }

    const dimmer = clamp01(scalarOf("dimmer", ch.dimmer, values, hold.dimmer));
    hold.dimmer = dimmer;
    const gate = shutterGate(ch.shutter, values, frame, hold.gate);

    // Rotation: the angle integrates the decoded speed (rps) over the frame time.
    const rps = scalarOf("laserRotation", ch.laserRotation, values, hold.rps);
    hold.rps = rps;
    const rotation = wrapAngle((prev?.rotation ?? 0) + rps * TWO_PI * frame.dt);

    // Pattern: pattern segment, else the option pattern (unmapped) or the previous pattern (unmatched).
    let pattern: LaserPattern = options.pattern;
    if (ch.laserPattern && isMapped(ch.laserPattern, values)) {
        pattern = prev?.pattern ?? options.pattern;
        const raw = readDmx(ch.laserPattern, values);
        const segment = raw === null ? null : findSegment(ch.laserPattern, raw);
        if (segment?.kind === "pattern") {
            pattern = segment.pattern;
        }
    }

    return {
        kind: "laser",
        on: dimmer > 0,
        intensity: clamp01(dimmer * gate),
        color: laserColor(ch, values, options, prev),
        pattern,
        beams: options.beams,
        size: clamp01(scalarOf("laserSize", ch.laserSize, values, prev?.size)),
        rotation,
        x: clampSigned(scalarOf("laserX", ch.laserX, values, prev?.x)),
        y: clampSigned(scalarOf("laserY", ch.laserY, values, prev?.y)),
    };
}

/** Flame, CO2 jet and cold spark: trigger on/off (off when unmapped), height = ratio × `maxHeight` (meters). */
function decodeHeight(
    kind: "flame" | "co2" | "spark",
    ch: CapabilityMapping["channels"],
    values: Uint8Array,
    options: HeightOptions,
    prev: EffectState | null
): EffectState {
    const prevHeight = prev && "height" in prev ? prev : null;
    const heldOn = prevHeight?.on ? 1 : 0;
    const on = scalarOf("trigger", ch.trigger, values, heldOn) >= TRIGGER_THRESHOLD;

    const maxHeight = options.maxHeight;
    const heldRatio = prevHeight && maxHeight > 0 ? prevHeight.height / maxHeight : undefined;
    const ratio = clamp01(scalarOf("height", ch.height, values, heldRatio));
    return { kind, on, height: ratio * maxHeight };
}

/**
 * Decodes one effect frame. `prev` is the state of the previous frame (null on the first frame); it provides the
 * held values and the integrated laser rotation.
 */
export function decodeEffect(
    kind: EffectKind,
    mapping: CapabilityMapping,
    values: Uint8Array,
    options: EffectOptions,
    frame: FrameContext,
    prev: EffectState | null
): EffectState {
    switch (kind) {
        case "laser":
            return decodeLaser(mapping, values, options as LaserOptions, frame, prev?.kind === "laser" ? prev : null);
        case "flame":
        case "co2":
        case "spark":
            return decodeHeight(kind, mapping.channels, values, options as HeightOptions, prev);
        case "fog": {
            const held = prev?.kind === "fog" ? prev.output : undefined;
            return { kind: "fog", output: clamp01(scalarOf("fogOutput", mapping.channels.fogOutput, values, held)) };
        }
    }
}
