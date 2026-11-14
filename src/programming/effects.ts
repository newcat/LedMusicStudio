/**
 * Effect engine (feature 004, research R8). Pure: no Vue/Pinia imports.
 * The phase comes from the timeline position, so playback and scrubbing agree (FR-011) and the speed follows the
 * tempo (units are beats).
 */

import { TICKS_PER_BEAT } from "@/constants";
import type { AttributeKey, FixtureProfile, Rgb } from "./attributes";
import { lerpColor } from "./color";
import type { EffectShape, EffectState } from "./states";
import type { Contribution, ItemContext } from "./types";

/** Phase offset in degrees for position `i` of `n` (group order), R8 steps 1–5. */
export function phaseOffset(i: number, n: number, spread: number, wings: number, blocks: number, interleave: number, backward: boolean): number {
    if (n <= 0) {
        return 0;
    }
    const W = Math.max(1, Math.round(wings));
    const B = Math.max(1, Math.round(blocks));
    const I = Math.max(1, Math.round(interleave));
    const pos = backward ? n - 1 - i : i;
    // 1. wings: mirror every other wing
    const s = Math.ceil(n / W);
    let k = pos % s;
    if (Math.floor(pos / s) % 2 === 1) {
        k = s - 1 - k;
    }
    // 2. blocks: neighbours share a phase
    k = Math.floor(k / B);
    // 3. interleave
    if (I > 1) {
        k = k % I;
    }
    // 4. number of distinct phases
    let m = Math.ceil(s / B);
    if (I > 1) {
        m = Math.min(m, I);
    }
    // 5.
    return m > 0 ? (spread * k) / m : 0;
}

/** −1..1; circle and figure-8 return [pan, tilt]. `t` in cycles. */
export function evaluateShape(shape: EffectShape, t: number): number | [number, number] {
    const f = t - Math.floor(t);
    const a = 2 * Math.PI * t;
    switch (shape) {
        case "sine":
            return Math.sin(a);
        case "triangle":
            return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
        case "sawUp":
            return 2 * f - 1;
        case "sawDown":
            return 1 - 2 * f;
        case "square":
            return f < 0.5 ? 1 : -1;
        case "circle":
            return [Math.cos(a), Math.sin(a)];
        case "figure8":
            return [Math.sin(a), Math.sin(2 * a)];
    }
    return 0;
}

/** Fade weight at item position `x` of length `L` (R9); fades are clamped to L/2, a fade of 0 counts as 1. */
export function fadeWeight(x: number, length: number, fadeIn: number, fadeOut: number): number {
    const fi = Math.min(Math.max(0, fadeIn), length / 2);
    const fo = Math.min(Math.max(0, fadeOut), length / 2);
    let w = 1;
    if (fi > 0) {
        w = Math.min(w, x / fi);
    }
    if (fo > 0) {
        w = Math.min(w, (length - x) / fo);
    }
    return Math.min(1, Math.max(0, w));
}

function first(v: number | [number, number]): number {
    return Array.isArray(v) ? v[0] : v;
}

function pair(v: number | [number, number]): [number, number] {
    return Array.isArray(v) ? v : [v, v];
}

/** Time of fixture `i` of `n` in cycles. */
export function effectTime(effect: EffectState, localPosition: number, i: number, n: number): number {
    const offset = phaseOffset(i, n, effect.spread, effect.wings, effect.blocks, effect.interleave, effect.direction === "backward");
    return localPosition / (effect.rateBeats * TICKS_PER_BEAT) + offset / 360;
}

/**
 * Contributions of an effect item, one per target fixture that supports the attribute. Absolute mode: value
 * `base + size·shape` with the fade as weight; relative mode: offset `size·shape`, the fade scales the size.
 */
export function evaluateEffect(effect: EffectState, ctx: ItemContext, getProfile: (fixtureId: string) => FixtureProfile | null): Contribution[] {
    const result: Contribution[] = [];
    const fixtures = ctx.target.fixtures;
    const n = fixtures.length;
    const fw = fadeWeight(ctx.localPosition, ctx.length, ctx.fadeIn, ctx.fadeOut);
    if (fw <= 0) {
        return result;
    }
    const relative = effect.mode === "relative" && effect.attribute !== "color";

    for (const f of fixtures) {
        const profile = getProfile(f.fixtureId);
        if (!profile) {
            continue;
        }
        const t = effectTime(effect, ctx.localPosition, f.index, n);
        const raw = evaluateShape(effect.shape, t);
        const contribution: Contribution = { fixtureId: f.fixtureId, priority: ctx.priority, attributes: {}, raw: null };
        const put = (key: AttributeKey, offset: number, base: number) => {
            if (!profile.supported.has(key)) {
                return;
            }
            contribution.attributes[key] = relative
                ? { value: offset, mode: "relative", weight: fw }
                : { value: base + offset, mode: "absolute", weight: fw };
        };

        switch (effect.attribute) {
            case "color": {
                if (!profile.supported.has("color")) {
                    break;
                }
                const s = Array.isArray(raw) ? raw[0] : raw;
                const color: Rgb = lerpColor(effect.colors[0], effect.colors[1], (s + 1) / 2);
                contribution.attributes.color = { value: color, mode: "absolute", weight: fw };
                break;
            }
            case "panTilt": {
                const [sp, st] = Array.isArray(raw) ? raw : [raw, raw];
                const size = pair(effect.size);
                const base = pair(effect.base);
                put("pan", size[0] * sp, base[0]);
                put("tilt", size[1] * st, base[1]);
                break;
            }
            case "pan":
            case "tilt": {
                const s = Array.isArray(raw) ? raw[0] : raw;
                put(effect.attribute, first(effect.size) * s, first(effect.base));
                break;
            }
            case "dimmer":
            case "zoom":
            case "focus": {
                // remapped to 0..1 so the size is the swing (R8)
                const s = ((Array.isArray(raw) ? raw[0] : raw) + 1) / 2;
                put(effect.attribute, first(effect.size) * s, first(effect.base));
                break;
            }
        }
        if (Object.keys(contribution.attributes).length > 0) {
            result.push(contribution);
        }
    }
    return result;
}
