import { FixtureType } from "../fixtures";
import { BlendMode } from "./blend";

/**
 * A layer's contribution to one LED strip fixture for a single frame.
 *
 * `alpha` is per pixel and is the reason layers work at all: "this layer did not touch pixel i" has to mean *transparent*, not
 * black, otherwise a chase composited over a wash blacks out every pixel it is not currently lighting.
 */
export interface LedStripLayer {
    readonly type: FixtureType.LED_STRIP;
    /** `numLeds * 3` values in 0..255, RGB interleaved. */
    readonly rgb: Float32Array;
    /** `numLeds` coverage values in 0..1. */
    readonly alpha: Float32Array;
}

/**
 * A layer's contribution to one DMX fixture for a single frame.
 *
 * DMX has no per-channel alpha because interpolating a channel is not always meaningful — see `dmxPrecedence.ts`. A channel is
 * either written by this layer or it is not; how a written channel combines with the layers below depends on its precedence.
 */
export interface DmxLayer {
    readonly type: FixtureType.DMX;
    /** One value per channel, 0..255. */
    readonly channels: Float32Array;
    /** 1 where this layer wrote the channel, 0 otherwise. */
    readonly mask: Uint8Array;
}

export type FixtureLayer = LedStripLayer | DmxLayer;

/** A single source's (graph item, script item) contribution to a frame, keyed by fixture id. */
export type LayerSet = Map<string, FixtureLayer>;

export interface LayerOptions {
    /** 0..1 */
    opacity: number;
    blendMode: BlendMode;
}

export const DEFAULT_LAYER_OPTIONS: Readonly<LayerOptions> = Object.freeze({
    opacity: 1,
    blendMode: "normal" as BlendMode,
});
