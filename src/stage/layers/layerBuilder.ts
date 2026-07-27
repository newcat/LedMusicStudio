import { Color } from "@/graph/colors";
import { scaleColorArray } from "@/utils";
import { BaseFixture, DmxFixture, FixtureType, LedStripFixture } from "../fixtures";
import { DmxLayer, LayerSet, LedStripLayer } from "./types";

const BLACK: Color = [0, 0, 0];

export function createLedStripLayer(numLeds: number): LedStripLayer {
    return { type: FixtureType.LED_STRIP, rgb: new Float32Array(numLeds * 3), alpha: new Float32Array(numLeds) };
}

export function createDmxLayer(numChannels: number): DmxLayer {
    return { type: FixtureType.DMX, channels: new Float32Array(numChannels), mask: new Uint8Array(numChannels) };
}

/**
 * Write a fully opaque contribution for `fixture` into `layers`, from a value in that fixture's own value format.
 *
 * This is the adapter for sources that produce a whole fixture value at once rather than painting into a layer — currently the
 * graph output nodes, whose `data` output is exactly what used to be handed to `fixture.setValue()`.
 */
export function writeOpaqueLayer(layers: LayerSet, fixture: BaseFixture, data: unknown): void {
    if (fixture instanceof LedStripFixture) {
        const numLeds = fixture.config.numLeds;
        const input = Array.isArray(data) && data.length > 0 ? (data as Color[]) : [BLACK];
        // matches what LedStripFixture.setValue used to do when a graph produced a differently sized array
        const colors = input.length === numLeds ? input : scaleColorArray(input, numLeds);

        const layer = createLedStripLayer(numLeds);
        for (let i = 0; i < numLeds; i++) {
            const color = colors[i] ?? BLACK;
            layer.rgb[i * 3] = color[0];
            layer.rgb[i * 3 + 1] = color[1];
            layer.rgb[i * 3 + 2] = color[2];
            layer.alpha[i] = 1;
        }
        layers.set(fixture.id, layer);
    } else if (fixture instanceof DmxFixture) {
        // sized to the data rather than to the fixture: the composer clamps to the fixture's real channel count, which saves
        // recomputing the (non-trivial) channel list every frame
        const values = Array.isArray(data) ? (data as number[]) : [];
        const layer = createDmxLayer(values.length);
        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            if (typeof value !== "number" || isNaN(value)) {
                // hole in a sparse array — this layer does not write the channel, so lower layers keep it
                continue;
            }
            layer.channels[i] = value;
            layer.mask[i] = 1;
        }
        layers.set(fixture.id, layer);
    }
}
