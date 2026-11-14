/**
 * Look evaluation (feature 004, research R9, data-model §6). Pure: preset and aim lookups are injected.
 */

import {
    ATTRIBUTES,
    cloneValue,
    type AttributeKey,
    type AttributeValue,
    type FixtureProfile,
    type Rgb,
} from "./attributes";
import { lerpColor } from "./color";
import { presetValue, type LookState, type LookValue, type PresetState } from "./states";
import type { Contribution, ItemContext, ResolvedFixture } from "./types";

export interface AimLookupResult {
    pan: number;
    tilt: number;
    /** e.g. "<fixture>: target out of range" (values are clamped). */
    warning?: string;
}

export interface LookLookups {
    profile(fixtureId: string): FixtureProfile | null;
    preset(presetId: string): PresetState | null;
    /** Pan/tilt aiming the fixture at the aim target; null = unset (missing target or no scene position). */
    aim(fixture: ResolvedFixture, aimTargetId: string, warnings: string[]): AimLookupResult | null;
}

/** Fan position of fixture `i` of `n`: `i/(n−1)`, mirrored `1 − |2i/(n−1) − 1|`; 0 for a single fixture. */
export function fanPosition(i: number, n: number, mirror: boolean): number {
    if (n <= 1) {
        return 0;
    }
    const p = i / (n - 1);
    return mirror ? 1 - Math.abs(2 * p - 1) : p;
}

function lerpValue(key: AttributeKey, from: AttributeValue, to: AttributeValue, p: number): AttributeValue {
    if (key === "color") {
        return lerpColor(from as Rgb, to as Rgb, p);
    }
    if (typeof from === "number" && typeof to === "number") {
        return from + (to - from) * p;
    }
    return p < 0.5 ? from : to;
}

/**
 * Value of one look attribute for a fixture at group position `fixture.index` of `n` (data-model §6):
 * perFixture → preset (per-fixture, then common, else unset) → fan → single. Aim values are handled by
 * `evaluateLook` (they set pan and tilt together). Returns undefined for "unset".
 */
export function resolveLookValue(
    look: LookState,
    key: AttributeKey,
    fixture: ResolvedFixture,
    n: number,
    lookups: Pick<LookLookups, "preset">,
    warnings: string[]
): AttributeValue | undefined {
    const baked = look.perFixture[fixture.fixtureId]?.[key];
    if (baked !== undefined) {
        return cloneValue(key, baked);
    }
    const value: LookValue | undefined = look.values[key];
    if (!value) {
        return undefined;
    }
    switch (value.kind) {
        case "preset": {
            const preset = lookups.preset(value.presetId);
            if (!preset) {
                if (!warnings.includes("Preset not found")) {
                    warnings.push("Preset not found");
                }
                return undefined;
            }
            const v = presetValue(preset, key, fixture.fixtureId);
            return v === undefined ? undefined : cloneValue(key, v);
        }
        case "fan":
            return lerpValue(key, value.from, value.to, fanPosition(fixture.index, n, value.mirror));
        case "single":
            return cloneValue(key, value.value);
        case "aim":
            return undefined;
    }
    return undefined;
}

/** Aim target of a look for pan/tilt: an aim value, or a position preset that aims at a target. */
function aimTargetOf(look: LookState, lookups: Pick<LookLookups, "preset">): string | null {
    const pan = look.values.pan;
    if (pan?.kind === "aim") {
        return pan.aimTargetId;
    }
    if (pan?.kind === "preset") {
        const preset = lookups.preset(pan.presetId);
        if (preset?.presetKind === "position" && preset.aimTargetId) {
            return preset.aimTargetId;
        }
    }
    return null;
}

/**
 * Per-fixture fade weight with fan timing (R9): each fixture's fade lasts F·(1−f) and starts after F·f·p_i, so the
 * whole fade still fits in F (FR-029). Fades are clamped to half the item.
 */
export function lookFadeWeight(x: number, length: number, fadeIn: number, fadeOut: number, fanTiming: number, p: number): number {
    const f = Math.min(1, Math.max(0, fanTiming));
    const fi = Math.min(Math.max(0, fadeIn), length / 2);
    const fo = Math.min(Math.max(0, fadeOut), length / 2);
    let w = 1;
    if (fi > 0) {
        const start = fi * f * p;
        const duration = fi * (1 - f);
        w = Math.min(w, duration > 0 ? (x - start) / duration : x >= start ? 1 : 0);
    }
    if (fo > 0) {
        const start = length - fo + fo * f * p;
        const duration = fo * (1 - f);
        w = Math.min(w, duration > 0 ? 1 - (x - start) / duration : x < start ? 1 : 0);
    }
    return Math.min(1, Math.max(0, w));
}

/** One contribution per target fixture, with fan values, fan timing and preset/aim resolution (R9). */
export function evaluateLook(look: LookState, ctx: ItemContext, lookups: LookLookups, warnings: string[]): Contribution[] {
    const result: Contribution[] = [];
    const fixtures = ctx.target.fixtures;
    const n = fixtures.length;
    const aimTargetId = aimTargetOf(look, lookups);

    for (const fixture of fixtures) {
        const profile = lookups.profile(fixture.fixtureId);
        if (!profile) {
            continue;
        }
        const p = n > 1 ? fixture.index / (n - 1) : 0;
        const weight = lookFadeWeight(ctx.localPosition, ctx.length, ctx.fadeIn, ctx.fadeOut, look.fanTiming, p);
        if (weight <= 0) {
            continue;
        }
        const contribution: Contribution = { fixtureId: fixture.fixtureId, priority: ctx.priority, attributes: {}, raw: null };
        const keys = new Set<AttributeKey>([
            ...(Object.keys(look.values) as AttributeKey[]),
            ...(Object.keys(look.perFixture[fixture.fixtureId] ?? {}) as AttributeKey[]),
        ]);

        if (aimTargetId && look.perFixture[fixture.fixtureId]?.pan === undefined) {
            keys.delete("pan");
            keys.delete("tilt");
            const aim = lookups.aim(fixture, aimTargetId, warnings);
            if (aim) {
                if (profile.supported.has("pan")) {
                    contribution.attributes.pan = { value: aim.pan, mode: "absolute", weight };
                }
                if (profile.supported.has("tilt")) {
                    contribution.attributes.tilt = { value: aim.tilt, mode: "absolute", weight };
                }
                if (aim.warning && !warnings.includes(aim.warning)) {
                    warnings.push(aim.warning);
                }
            }
        }

        for (const key of keys) {
            if (!profile.supported.has(key) || !ATTRIBUTES[key]) {
                continue;
            }
            const value = resolveLookValue(look, key, fixture, n, lookups, warnings);
            if (value !== undefined) {
                contribution.attributes[key] = { value, mode: "absolute", weight };
            }
        }
        if (Object.keys(contribution.attributes).length > 0) {
            result.push(contribution);
        }
    }
    return result;
}
