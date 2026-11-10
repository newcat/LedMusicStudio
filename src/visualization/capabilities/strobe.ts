/**
 * Shutter and strobe gate (feature 003, research R5). Turns the active shutter segment into a gate 0..1 per frame,
 * using view time. Per-frame logic only: no Vue/Pinia imports.
 */

import type { ShutterSegment } from "./types";
import type { FrameContext } from "@/visualization/fixtureVisualizations/base.renderer";

/** Share of each strobe period during which the light is on. */
const STROBE_DUTY = 0.3;

/** Deterministic hash of an integer period index to 0..1 (random effect: one value per period). */
function hashUnit(n: number): number {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

export class ShutterGate {
    private frameCount = 0;

    /**
     * @param segment Shutter segment that applies to the DMX value, or null when none applies (light not gated: 1).
     * @param raw DMX value in the units of the segment (`from`/`to`); its position inside the segment sets the rate.
     * @returns Gate 0..1 for this frame.
     */
    update(segment: ShutterSegment | null, raw: number, frame: FrameContext): number {
        this.frameCount++;
        if (!segment || segment.effect === "open") {
            return 1;
        }
        if (segment.effect === "closed") {
            return 0;
        }

        const span = segment.to - segment.from;
        const position = span === 0 ? 0 : clamp01((raw - segment.from) / span);
        const rate = Math.min(
            segment.rateStart + (segment.rateEnd - segment.rateStart) * position,
            frame.flashLimit ?? Infinity
        );
        if (!(rate > 0)) {
            return 1;
        }

        // Refresh-rate safety: sampling a flash that is faster than half the frame rate aliases into steady light,
        // so the gate alternates every frame instead.
        if (rate > frame.fps / 2) {
            return this.frameCount % 2 === 1 ? 1 : 0;
        }

        const cycles = frame.time * rate;
        const period = Math.floor(cycles);
        const phase = cycles - period;

        if (segment.effect === "strobe") {
            // "At least one frame on": the first frame that starts a period is on, even if the duty is shorter than a frame.
            const startsPeriod = Math.floor((frame.time - frame.dt) * rate) < period;
            return phase < STROBE_DUTY || startsPeriod ? 1 : 0;
        }
        if (segment.effect === "pulse") {
            return 1 - phase;
        }
        if (segment.effect === "rampUp") {
            return phase;
        }
        if (segment.effect === "rampDown") {
            return 1 - phase;
        }
        if (segment.effect === "rampUpDown") {
            return 1 - Math.abs(2 * phase - 1);
        }
        return hashUnit(period);
    }
}
