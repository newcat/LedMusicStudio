/**
 * Overlap prevention and snapping math (feature 005, research R6/R7). Pure: ticks are plain numbers, no store imports.
 * Only moving-vs-static pairs are checked, so static clips that already overlap each other (old projects) are ignored.
 */

export interface Span {
    id: string;
    start: number;
    end: number;
    /** Destination track index for moving spans, track index for static spans. */
    trackIndex: number;
}

/**
 * The allowed delta closest to `candidate` for moving the whole `moving` group, or null if none is reachable.
 * Each static on a moving span's destination track forbids the open interval (static.start − m.end, static.end − m.start).
 * Deltas that make any start negative are forbidden. Touching (end == start) is allowed. Ties go towards 0.
 */
export function allowedDelta(moving: readonly Span[], statics: readonly Span[], candidate: number): number | null {
    if (moving.length === 0) {
        return candidate;
    }
    const lower = -Math.min(...moving.map((m) => m.start));

    const byTrack = new Map<number, Span[]>();
    for (const s of statics) {
        const list = byTrack.get(s.trackIndex);
        if (list) {
            list.push(s);
        } else {
            byTrack.set(s.trackIndex, [s]);
        }
    }

    const intervals: Array<[number, number]> = [];
    for (const m of moving) {
        for (const s of byTrack.get(m.trackIndex) ?? []) {
            const a = s.start - m.end;
            const b = s.end - m.start;
            if (a < b) {
                intervals.push([a, b]);
            }
        }
    }
    intervals.sort((x, y) => x[0] - y[0]);

    // merge strictly overlapping open intervals; touching intervals leave their shared point allowed
    const merged: Array<[number, number]> = [];
    for (const iv of intervals) {
        const last = merged[merged.length - 1];
        if (last && iv[0] < last[1]) {
            last[1] = Math.max(last[1], iv[1]);
        } else {
            merged.push([iv[0], iv[1]]);
        }
    }

    const c = Math.max(candidate, lower);
    const hit = merged.find(([a, b]) => a < c && c < b);
    if (!hit) {
        return c;
    }
    const [a, b] = hit;
    const options = [b];
    if (a >= lower) {
        options.push(a);
    }
    let best: number | null = null;
    for (const o of options) {
        if (best === null) {
            best = o;
            continue;
        }
        const dO = Math.abs(o - candidate);
        const dB = Math.abs(best - candidate);
        if (dO < dB || (dO === dB && Math.abs(o) < Math.abs(best))) {
            best = o;
        }
    }
    return best;
}

/**
 * Clamps a resized edge to the nearest neighbour on the same track and keeps `end − start ≥ minLength`.
 * Statics that already overlap the span are ignored.
 */
export function clampResize(span: Span, edge: "start" | "end", value: number, statics: readonly Span[], minLength = 1): number {
    const neighbours = statics.filter((s) => s.trackIndex === span.trackIndex && s.id !== span.id);
    if (edge === "end") {
        let limit = Infinity;
        for (const s of neighbours) {
            if (s.start >= span.end) {
                limit = Math.min(limit, s.start);
            }
        }
        return Math.max(span.start + minLength, Math.min(value, limit));
    }
    let limit = 0;
    for (const s of neighbours) {
        if (s.end <= span.start) {
            limit = Math.max(limit, s.end);
        }
    }
    return Math.min(span.end - minLength, Math.max(value, limit));
}

/** Magnetic snap targets: every static edge plus the playhead, sorted. */
export function snapCandidates(statics: readonly Span[], playhead: number): number[] {
    const result: number[] = [playhead];
    for (const s of statics) {
        result.push(s.start, s.end);
    }
    return result.sort((a, b) => a - b);
}

/** Nearest value of sorted `candidates` to `x`, or null for an empty list. */
function nearest(candidates: readonly number[], x: number): number | null {
    if (candidates.length === 0) {
        return null;
    }
    let lo = 0;
    let hi = candidates.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (candidates[mid] < x) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    const right = candidates[lo];
    const left = lo > 0 ? candidates[lo - 1] : right;
    return Math.abs(left - x) <= Math.abs(right - x) ? left : right;
}

/**
 * The delta that moves the moving edge closest to a candidate onto it, if within `thresholdTicks` of `rawDelta`;
 * otherwise null. `candidates` must be sorted.
 */
export function magneticDelta(moving: readonly Span[], candidates: readonly number[], rawDelta: number, thresholdTicks: number): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const m of moving) {
        for (const edge of [m.start + rawDelta, m.end + rawDelta]) {
            const c = nearest(candidates, edge);
            if (c === null) {
                continue;
            }
            const dist = Math.abs(c - edge);
            if (dist <= thresholdTicks && dist < bestDist) {
                bestDist = dist;
                best = rawDelta + (c - edge);
            }
        }
    }
    return best;
}

/** The candidate within `thresholdTicks` of `edge`, or null. `candidates` must be sorted. */
export function magneticEdge(edge: number, candidates: readonly number[], thresholdTicks: number): number | null {
    const c = nearest(candidates, edge);
    return c !== null && Math.abs(c - edge) <= thresholdTicks ? c : null;
}
