/**
 * Color math of the programming engine (feature 004, research R3/R9). Pure: no Vue/Pinia imports.
 * - sRGB ↔ linear RGB, sRGB → OKLab, OKLab distance (closest wheel slot)
 * - interpolation in linear RGB (no dark midpoints)
 * - Kelvin → sRGB, reusing the approximation of the capability decoder (colorMath.ts)
 */

import { kelvinToRgb } from "@/visualization/capabilities/colorMath";
import type { Rgb, SlotInfo } from "./attributes";

export function srgbToLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
    const v = Math.min(1, Math.max(0, c));
    return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** OKLab (Björn Ottosson) of an sRGB color. */
export function srgbToOklab(rgb: Rgb): [number, number, number] {
    const r = srgbToLinear(rgb[0]);
    const g = srgbToLinear(rgb[1]);
    const b = srgbToLinear(rgb[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

export function oklabDistance(a: Rgb, b: Rgb): number {
    const la = srgbToOklab(a);
    const lb = srgbToOklab(b);
    return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

const WHITE: Rgb = [1, 1, 1];

/**
 * Slot number with the smallest OKLab distance to `rgb`. Candidates: open slots (as white) and color slots with
 * exactly one color; split colors are excluded (FR-006). Returns 0 when there is no candidate.
 */
export function closestColorSlot(slots: SlotInfo[], rgb: Rgb): number {
    let best = 0;
    let bestDistance = Infinity;
    for (const slot of slots) {
        const candidate = slot.kind === "open" ? WHITE : slot.kind === "color" ? slot.rgb : null;
        if (!candidate) {
            continue;
        }
        const d = oklabDistance(candidate, rgb);
        if (d < bestDistance) {
            bestDistance = d;
            best = slot.number;
        }
    }
    return best;
}

/** Interpolates two sRGB colors in linear RGB and returns sRGB (R9). Writes into `out` if given. */
export function lerpColor(a: Rgb, b: Rgb, t: number, out: Rgb = [0, 0, 0]): Rgb {
    for (let i = 0; i < 3; i++) {
        const la = srgbToLinear(a[i]);
        const lb = srgbToLinear(b[i]);
        out[i] = linearToSrgb(la + (lb - la) * t);
    }
    return out;
}

/** Kelvin → sRGB 0..1, normalized so 6500 K is white (same approximation as the decoder's `kelvinToRgb`). */
export function kelvinToSrgb(kelvin: number): Rgb {
    const c = kelvinToRgb(kelvin);
    const max = Math.max(1, c.r, c.g, c.b);
    return [linearToSrgb(c.r / max), linearToSrgb(c.g / max), linearToSrgb(c.b / max)];
}

/** "#rrggbb" → sRGB 0..1, null for invalid strings. */
export function hexToRgb(hex: string): Rgb | null {
    let h = hex.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(h)) {
        h = h
            .split("")
            .map((c) => c + c)
            .join("");
    }
    if (!/^[0-9a-f]{6}$/i.test(h)) {
        return null;
    }
    const n = parseInt(h, 16);
    return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

export function rgbToHex(rgb: Rgb): string {
    return (
        "#" +
        rgb
            .map((c) =>
                Math.round(Math.min(1, Math.max(0, c)) * 255)
                    .toString(16)
                    .padStart(2, "0")
            )
            .join("")
    );
}
