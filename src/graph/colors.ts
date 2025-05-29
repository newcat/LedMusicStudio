import chroma, { Color as ChromaColor } from "chroma-js";

type BlendMode = "multiply" | "darken" | "lighten" | "screen" | "overlay" | "burn" | "dodge";

export { chroma };

export type Color = [number, number, number];

export function toChroma(c: Color): ChromaColor {
    return chroma(c[0], c[1], c[2], "rgb");
}

export function fromChroma(c: ChromaColor): Color {
    return c.rgb();
}

export function mix(a: Color, b: Color, factor = 0.5, colorSpace: chroma.InterpolationMode = "rgb"): Color {
    return fromChroma(chroma.mix(toChroma(a), toChroma(b), factor, colorSpace));
}

export function blend(a: Color, b: Color, mode: BlendMode): Color {
    return fromChroma(chroma.blend(toChroma(a), toChroma(b), mode));
}

export function darken(a: Color, f: number): Color {
    return fromChroma(toChroma(a).darken(f));
}

export function brighten(a: Color, f: number): Color {
    return fromChroma(toChroma(a).brighten(f));
}
