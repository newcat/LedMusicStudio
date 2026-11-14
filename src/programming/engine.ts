/**
 * Merge engine (feature 004, research R4). Pure: no Vue/Pinia imports; fixture data comes in through `getFixture`.
 *
 * Per fixture: defaults → contributions in priority order (absolute continuous: lerp by weight; discrete: switch at
 * w ≥ 0.5; relative: add and clamp) → encode → raw override per channel where the raw priority is at least the
 * priority of the attribute that wrote the channel. Stateless (FR-011): the per-fixture buffers below are reused
 * for speed only (R12); every frame starts from the defaults.
 */

import type { CapabilityMapping } from "@/visualization/capabilities/types";
import {
    clampToRange,
    isDiscrete,
    isNumericContinuous,
    validateAttributeValue,
    type AttributeKey,
    type AttributeValueMap,
    type EncodeResult,
    type FixtureProfile,
    type Rgb,
    type ShutterValue,
    type SlotAttributeKey,
} from "./attributes";
import { lerpColor } from "./color";
import { encodeAttributes } from "./encode";
import { comparePriority, type Contribution, type Priority } from "./types";

export interface EngineFixture {
    profile: FixtureProfile;
    mapping: CapabilityMapping;
    /** Reused encoder output; set by the engine. */
    encodeBuffer: EncodeResult | null;
}

interface FoldBuffers {
    values: AttributeValueMap;
    writers: Partial<Record<AttributeKey, Priority | null>>;
    output: number[];
}

const buffers = new WeakMap<FixtureProfile, FoldBuffers>();

function buffersOf(profile: FixtureProfile): FoldBuffers {
    let b = buffers.get(profile);
    if (!b) {
        b = {
            values: { ...profile.defaults, color: [1, 1, 1], shutter: { mode: "open", rate: 0 } },
            writers: {},
            output: new Array<number>(profile.channelCount).fill(0),
        };
        buffers.set(profile, b);
    }
    return b;
}

function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}

/** Last fold result per fixture, for the debug helper. */
export const lastFold = new Map<string, { values: AttributeValueMap; writers: Partial<Record<AttributeKey, Priority | null>> }>();

/**
 * Merges one frame. Returns the channel values of every fixture in `fixtureIds` that has a profile (the arrays are
 * reused between frames: copy them if they must persist).
 */
export function mergeFrame(
    contributions: readonly Contribution[],
    fixtureIds: readonly string[],
    getFixture: (fixtureId: string) => EngineFixture | null
): Map<string, number[]> {
    const byFixture = new Map<string, Contribution[]>();
    for (const c of contributions) {
        let list = byFixture.get(c.fixtureId);
        if (!list) {
            list = [];
            byFixture.set(c.fixtureId, list);
        }
        list.push(c);
    }

    const result = new Map<string, number[]>();
    for (const fixtureId of fixtureIds) {
        const fixture = getFixture(fixtureId);
        if (!fixture) {
            continue;
        }
        const list = byFixture.get(fixtureId) ?? [];
        // stable sort: equal priorities keep their order of arrival
        list.sort((a, b) => comparePriority(a.priority, b.priority));
        result.set(fixtureId, mergeFixture(fixture, list));
    }
    return result;
}

function mergeFixture(fixture: EngineFixture, list: readonly Contribution[]): number[] {
    const profile = fixture.profile;
    const b = buffersOf(profile);
    const values = b.values;
    const writers = b.writers;

    // 1. defaults (per-fixture overrides included)
    Object.assign(values, profile.defaults);
    values.color = [profile.defaults.color[0], profile.defaults.color[1], profile.defaults.color[2]];
    values.shutter = { ...profile.defaults.shutter };
    for (const key of Object.keys(writers) as AttributeKey[]) {
        writers[key] = null;
    }

    // 2.–3. fold in priority order
    for (const c of list) {
        for (const key of Object.keys(c.attributes) as AttributeKey[]) {
            const a = c.attributes[key];
            if (!a || !profile.supported.has(key)) {
                continue;
            }
            const w = clamp01(a.weight);
            if (!(w > 0)) {
                continue;
            }
            if (key === "color") {
                const target = validateAttributeValue("color", a.value);
                if (target) {
                    lerpColor(values.color, target as Rgb, w, values.color);
                    writers.color = c.priority;
                }
            } else if (isDiscrete(key)) {
                if (w < 0.5) {
                    continue;
                }
                if (key === "shutter") {
                    const v = validateAttributeValue("shutter", a.value);
                    if (v) {
                        values.shutter = v as ShutterValue;
                        writers.shutter = c.priority;
                    }
                } else {
                    const slots = profile.slots[key as SlotAttributeKey];
                    const v = validateAttributeValue(key, a.value, slots?.length);
                    if (v !== null) {
                        (values as unknown as Record<string, number>)[key] = v as number;
                        writers[key] = c.priority;
                    }
                }
            } else if (isNumericContinuous(key) && typeof a.value === "number" && Number.isFinite(a.value)) {
                const current = values[key];
                const next = a.mode === "relative" ? current + a.value * w : current + (a.value - current) * w;
                values[key] = clampToRange(profile, key, next);
                writers[key] = c.priority;
            }
        }
    }

    // 4. encode; explicitly set attributes (clips, per-fixture defaults) take shared channels first
    const isSet = (key: AttributeKey) => (writers[key] ?? null) !== null || profile.overridden.has(key);
    const encoded = encodeAttributes(profile, fixture.mapping, values, isSet, fixture.encodeBuffer ?? undefined);
    fixture.encodeBuffer = encoded;

    // 5. raw override per channel
    const out = b.output.length === profile.channelCount ? b.output : (b.output = new Array<number>(profile.channelCount).fill(0));
    for (let i = 0; i < out.length; i++) {
        out[i] = encoded.values[i];
    }
    for (const c of list) {
        if (!c.raw) {
            continue;
        }
        for (const [channel, value] of c.raw) {
            if (channel < 0 || channel >= out.length) {
                continue;
            }
            const writer = encoded.writtenBy[channel];
            const writerPriority = writer ? (writers[writer] ?? null) : null;
            if (writerPriority === null || comparePriority(c.priority, writerPriority) >= 0) {
                out[channel] = Number.isFinite(value) ? Math.max(0, Math.min(255, Math.round(value))) : 0;
            }
        }
    }

    lastFold.set(profile.fixtureId, { values, writers });
    return out;
}
