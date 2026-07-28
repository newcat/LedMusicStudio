import { makeNoise2D } from "open-simplex-noise";

export interface SeededRandom {
    next(): number;
    noise2D(x: number, y: number): number;
}

export function hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/**
 * Randomness for sequences is seeded and reset whenever a sequence restarts, so the same tick always produces the same value.
 *
 * Without this, seeking or re-rendering a project would produce different output every time, and generative effects would be
 * impossible to iterate on. Same idea as Sonic Pi's deterministic randomness.
 */
export function createSeededRandom(seed: number): SeededRandom {
    // mulberry32 — small, fast and good enough for visual randomness
    let state = seed >>> 0;
    const noise = makeNoise2D(seed);
    return {
        next(): number {
            state = (state + 0x6d2b79f5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        },
        noise2D: noise,
    };
}
