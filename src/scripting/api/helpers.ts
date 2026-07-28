import { TICKS_PER_BEAT } from "@/constants";
import { chroma, Color, mix as mixColors } from "@/graph/colors";

/** Beats expressed in ticks. */
export function beats(count: number): number {
    return Math.round(count * TICKS_PER_BEAT);
}

/** Bars expressed in ticks. */
export function bars(count: number, beatsPerBar = 4): number {
    return Math.round(count * beatsPerBar * TICKS_PER_BEAT);
}

/**
 * Build a colour from hue, saturation and value.
 *
 * Hue is 0..1 rather than 0..360 so it wraps naturally when driven by a phase or a position along a strip.
 */
export function hsv(hue: number, saturation: number, value: number): LMSColor {
    const wrapped = (((hue % 1) + 1) % 1) * 360;
    return chroma.hsv(wrapped, saturation, value).rgb() as LMSColor;
}

export function mix(a: LMSColor, b: LMSColor, factor: number): LMSColor {
    return mixColors(a as Color, b as Color, factor) as LMSColor;
}
