/**
 * Time formatting for the timeline (feature 005, research R13/R14). Pure; 4/4 time is assumed.
 * Check: 432 ticks at 120 BPM → formatBarBeat "5.3", formatMinSec(ticksToSeconds) "0:09".
 */

import { TICKS_PER_BEAT } from "@/constants";

const BEATS_PER_BAR = 4;
const TICKS_PER_BAR = BEATS_PER_BAR * TICKS_PER_BEAT;

function round3(v: number): number {
    return Math.round(v * 1000) / 1000;
}

/** "5.3.12": 1-based bar and beat, ticks within the beat. */
export function formatBarBeatTick(ticks: number): string {
    const t = Math.max(0, ticks);
    const bar = Math.floor(t / TICKS_PER_BAR) + 1;
    const beat = Math.floor((t % TICKS_PER_BAR) / TICKS_PER_BEAT) + 1;
    const tick = round3(t % TICKS_PER_BEAT);
    return `${bar}.${beat}.${tick}`;
}

/** Accepts "5", "5.3" and "5.3.12". Null for invalid input or negative results. */
export function parseBarBeatTick(text: string): number | null {
    const parts = text.trim().split(".");
    if (parts.length < 1 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) {
        return null;
    }
    const [bar, beat = 1, tick = 0] = parts.map((p) => parseInt(p, 10));
    if (bar < 1 || beat < 1) {
        return null;
    }
    const result = (bar - 1) * TICKS_PER_BAR + (beat - 1) * TICKS_PER_BEAT + tick;
    return result >= 0 ? result : null;
}

/** "5.3": 1-based bar and beat. */
export function formatBarBeat(ticks: number): string {
    const t = Math.max(0, ticks);
    const bar = Math.floor(t / TICKS_PER_BAR) + 1;
    const beat = Math.floor((t % TICKS_PER_BAR) / TICKS_PER_BEAT) + 1;
    return `${bar}.${beat}`;
}

export function ticksToBeats(ticks: number): number {
    return ticks / TICKS_PER_BEAT;
}

export function beatsToTicks(beats: number): number {
    return beats * TICKS_PER_BEAT;
}

/** Decimal beats with at most 3 digits. */
export function formatBeats(ticks: number): string {
    return String(round3(ticksToBeats(ticks)));
}

/** Decimal beats (≥ 0) in ticks, or null. */
export function parseBeats(text: string): number | null {
    const t = text.trim().replace(",", ".");
    if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) {
        return null;
    }
    const v = parseFloat(t);
    return Number.isFinite(v) && v >= 0 ? beatsToTicks(v) : null;
}

export function ticksToSeconds(ticks: number, bpm: number): number {
    return bpm > 0 ? (ticks / TICKS_PER_BEAT / bpm) * 60 : 0;
}

/** "0:09". */
export function formatMinSec(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
