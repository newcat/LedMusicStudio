import * as THREE from "three";

/**
 * Color helpers of the capability pipeline (research R4). Every color here is linear RGB; values above 1 are
 * allowed (they bloom).
 */

const MIN_KELVIN = 1000;
const MAX_KELVIN = 40000;

function srgbToLinear(c: number): number {
    return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

function clamp255(v: number): number {
    return Math.min(255, Math.max(0, v));
}

/** Tanner Helland's approximation, as sRGB 0..1 per channel. */
function kelvinToSrgb(k: number): [number, number, number] {
    const t = Math.min(MAX_KELVIN, Math.max(MIN_KELVIN, k)) / 100;
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp255(r) / 255, clamp255(g) / 255, clamp255(b) / 255];
}

/** Linear RGB of 6500 K before normalization; every result is divided by it so that 6500 K is (1, 1, 1). */
const REFERENCE_6500 = kelvinToSrgb(6500).map(srgbToLinear) as [number, number, number];

/** Color temperature to linear RGB, clamped to 1000–40000 K and normalized so 6500 K = (1, 1, 1). */
export function kelvinToRgb(k: number, out: THREE.Color = new THREE.Color()): THREE.Color {
    const [r, g, b] = kelvinToSrgb(Number.isFinite(k) ? k : 6500);
    return out.setRGB(
        srgbToLinear(r) / REFERENCE_6500[0],
        srgbToLinear(g) / REFERENCE_6500[1],
        srgbToLinear(b) / REFERENCE_6500[2],
        THREE.LinearSRGBColorSpace
    );
}

/**
 * `#rgb` / `#rrggbb` (sRGB, the "#" is optional) to linear RGB. Invalid strings give black.
 */
export function hexToLinear(hex: string, out: THREE.Color = new THREE.Color()): THREE.Color {
    let h = hex.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(h)) {
        h = h
            .split("")
            .map((c) => c + c)
            .join("");
    }
    if (!/^[0-9a-f]{6}$/i.test(h)) {
        return out.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace);
    }
    const n = parseInt(h, 16);
    return out.setRGB(
        srgbToLinear(((n >> 16) & 0xff) / 255),
        srgbToLinear(((n >> 8) & 0xff) / 255),
        srgbToLinear((n & 0xff) / 255),
        THREE.LinearSRGBColorSpace
    );
}

/** Relative luminance (Rec. 709 weights) of a linear color. */
export function luminance(c: { r: number; g: number; b: number }): number {
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function linear(r: number, g: number, b: number): THREE.Color {
    return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}

/** Additive primaries beyond R/G/B (research R4). Shared constants: never modify them, clone instead. */
export const WHITE_RGB: Readonly<THREE.Color> = linear(1, 1, 1);
export const AMBER_RGB: Readonly<THREE.Color> = linear(1, 0.75, 0);
export const UV_RGB: Readonly<THREE.Color> = linear(0.25, 0, 0.6);
export const LIME_RGB: Readonly<THREE.Color> = linear(0.6, 1, 0);
export const INDIGO_RGB: Readonly<THREE.Color> = linear(0.3, 0, 1);
export const WARM_WHITE_RGB: Readonly<THREE.Color> = kelvinToRgb(3000);
export const COLD_WHITE_RGB: Readonly<THREE.Color> = kelvinToRgb(6500);

/** The same primaries by capability key, for the additive mix. */
export const ADDITIVE_PRIMARIES = {
    red: linear(1, 0, 0),
    green: linear(0, 1, 0),
    blue: linear(0, 0, 1),
    white: WHITE_RGB,
    amber: AMBER_RGB,
    uv: UV_RGB,
    lime: LIME_RGB,
    indigo: INDIGO_RGB,
    warmWhite: WARM_WHITE_RGB,
    coldWhite: COLD_WHITE_RGB,
} as const satisfies Record<string, Readonly<THREE.Color>>;
