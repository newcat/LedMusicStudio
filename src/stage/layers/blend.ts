/**
 * Separable blend modes, following the W3C compositing spec.
 *
 * These are deliberately kept separate from the chroma-js based helpers in `@/graph/colors`: the compositor runs these once per
 * channel per pixel per layer per frame, which is far too hot a path for chroma-js (it allocates a `Color` object per call).
 * The graph nodes keep using chroma-js, where call volume is low.
 *
 * All functions operate on normalized 0..1 values.
 */

export const BLEND_MODES = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "dodge", "burn"] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
    normal: "Normal",
    multiply: "Multiply",
    screen: "Screen",
    overlay: "Overlay",
    darken: "Darken",
    lighten: "Lighten",
    dodge: "Color Dodge",
    burn: "Color Burn",
};

export type BlendFunction = (backdrop: number, source: number) => number;

const BLEND_FUNCTIONS: Record<BlendMode, BlendFunction> = {
    normal: (_backdrop, source) => source,
    multiply: (backdrop, source) => backdrop * source,
    screen: (backdrop, source) => backdrop + source - backdrop * source,
    overlay: (backdrop, source) => (backdrop <= 0.5 ? 2 * backdrop * source : 1 - 2 * (1 - backdrop) * (1 - source)),
    darken: (backdrop, source) => Math.min(backdrop, source),
    lighten: (backdrop, source) => Math.max(backdrop, source),
    dodge: (backdrop, source) => (source >= 1 ? 1 : Math.min(1, backdrop / (1 - source))),
    burn: (backdrop, source) => (source <= 0 ? 0 : 1 - Math.min(1, (1 - backdrop) / source)),
};

/**
 * Resolve a blend mode to its function once, before entering a per-pixel loop, rather than switching on the mode inside it.
 */
export function getBlendFunction(mode: BlendMode): BlendFunction {
    return BLEND_FUNCTIONS[mode] ?? BLEND_FUNCTIONS.normal;
}
