import { Color } from "@/graph/colors";
import { clamp } from "@/utils";
import { BaseFixture, DmxFixture, FixtureType, LedStripFixture } from "../fixtures";
import { getBlendFunction } from "./blend";
import { ChannelBlendBehaviour, getChannelBlendBehaviours } from "./dmxChannelBehaviour";
import { DEFAULT_LAYER_OPTIONS, LayerOptions, LayerSet } from "./types";

interface LedStripSlot {
    readonly type: FixtureType.LED_STRIP;
    readonly fixture: LedStripFixture;
    numLeds: number;
    /** `numLeds * 3` accumulator, RGB interleaved, 0..255 */
    buffer: Float32Array;
}

interface DmxSlot {
    readonly type: FixtureType.DMX;
    readonly fixture: DmxFixture;
    numChannels: number;
    behaviours: ChannelBlendBehaviour[];
    /** one accumulator value per channel, 0..255 */
    buffer: Float32Array;
}

type FixtureSlot = LedStripSlot | DmxSlot;

/**
 * Composites the per-frame layers produced by every active source (graph item, script item) down onto the stage fixtures.
 *
 * Usage per tick:
 *
 * ```
 * composer.beginFrame();
 * for (const source of sourcesBottomToTop) composer.composite(source.layers, source.options);
 * composer.commit();
 * ```
 *
 * `beginFrame` zeroes every fixture, which is what replaced the old "reset any fixture no graph touched" pass: a fixture nobody
 * writes simply ends the frame at its zeroed base.
 */
export class FrameComposer {
    private readonly token = Symbol("FrameComposer");
    private readonly slots = new Map<string, FixtureSlot>();

    public constructor(private readonly fixtures: ReadonlyMap<string, BaseFixture>) {}

    /** Reset every fixture accumulator to black / zero. Call once per tick, before compositing any layers. */
    public beginFrame(): void {
        this.syncSlots();
        for (const slot of this.slots.values()) {
            slot.buffer.fill(0);
        }
    }

    /** Composite one source's contribution on top of everything added so far this frame. */
    public composite(layers: LayerSet, options: LayerOptions = DEFAULT_LAYER_OPTIONS): void {
        const opacity = clamp(options.opacity, 0, 1);
        if (opacity <= 0) {
            return;
        }

        const blend = getBlendFunction(options.blendMode);
        for (const [fixtureId, layer] of layers) {
            const slot = this.slots.get(fixtureId);
            if (!slot || slot.type !== layer.type) {
                // the fixture was removed or changed type since the layer was built
                continue;
            }

            if (slot.type === FixtureType.LED_STRIP && layer.type === FixtureType.LED_STRIP) {
                const count = Math.min(slot.numLeds, layer.alpha.length);
                for (let i = 0; i < count; i++) {
                    const alpha = layer.alpha[i] * opacity;
                    if (alpha <= 0) {
                        continue;
                    }
                    for (let c = 0; c < 3; c++) {
                        const idx = i * 3 + c;
                        const backdrop = slot.buffer[idx] / 255;
                        const blended = blend(backdrop, layer.rgb[idx] / 255);
                        slot.buffer[idx] = (backdrop + (blended - backdrop) * alpha) * 255;
                    }
                }
            } else if (slot.type === FixtureType.DMX && layer.type === FixtureType.DMX) {
                const count = Math.min(slot.numChannels, layer.mask.length);
                for (let i = 0; i < count; i++) {
                    if (!layer.mask[i]) {
                        continue;
                    }
                    if (slot.behaviours[i] === "discrete") {
                        // selection channels cannot be interpolated: the layer either takes the channel or leaves it alone
                        if (opacity >= 0.5) {
                            slot.buffer[i] = layer.channels[i];
                        }
                    } else {
                        const backdrop = slot.buffer[i] / 255;
                        const blended = blend(backdrop, layer.channels[i] / 255);
                        slot.buffer[i] = (backdrop + (blended - backdrop) * opacity) * 255;
                    }
                }
            }
        }
    }

    /** Write the composited frame to the fixtures. */
    public commit(): void {
        for (const slot of this.slots.values()) {
            if (slot.type === FixtureType.LED_STRIP) {
                const colors: Color[] = new Array(slot.numLeds);
                for (let i = 0; i < slot.numLeds; i++) {
                    const idx = i * 3;
                    colors[i] = [
                        clamp(slot.buffer[idx], 0, 255),
                        clamp(slot.buffer[idx + 1], 0, 255),
                        clamp(slot.buffer[idx + 2], 0, 255),
                    ];
                }
                slot.fixture.setValue(colors);
            } else {
                const values: number[] = new Array(slot.numChannels);
                for (let i = 0; i < slot.numChannels; i++) {
                    values[i] = slot.buffer[i];
                }
                // DmxFixture.setValue clamps and floors
                slot.fixture.setValue(values);
            }
        }
    }

    public dispose(): void {
        for (const fixture of this.fixtures.values()) {
            fixture.events.configChanged.unsubscribe(this.token);
        }
        this.slots.clear();
    }

    /** Add slots for new fixtures, drop slots for removed ones. Slot geometry is cached and invalidated by `configChanged`. */
    private syncSlots(): void {
        for (const [id, fixture] of this.fixtures) {
            if (this.slots.has(id)) {
                continue;
            }
            const slot = this.createSlot(fixture);
            if (!slot) {
                continue;
            }
            this.slots.set(id, slot);
            fixture.events.configChanged.subscribe(this.token, () => this.resizeSlot(slot));
        }

        for (const id of [...this.slots.keys()]) {
            if (!this.fixtures.has(id)) {
                this.slots.get(id)!.fixture.events.configChanged.unsubscribe(this.token);
                this.slots.delete(id);
            }
        }
    }

    private createSlot(fixture: BaseFixture): FixtureSlot | null {
        if (fixture instanceof LedStripFixture) {
            const numLeds = fixture.config.numLeds;
            return { type: FixtureType.LED_STRIP, fixture, numLeds, buffer: new Float32Array(numLeds * 3) };
        } else if (fixture instanceof DmxFixture) {
            const behaviours = getChannelBlendBehaviours(fixture);
            return {
                type: FixtureType.DMX,
                fixture,
                numChannels: behaviours.length,
                behaviours,
                buffer: new Float32Array(behaviours.length),
            };
        }
        return null;
    }

    private resizeSlot(slot: FixtureSlot): void {
        if (slot.type === FixtureType.LED_STRIP) {
            slot.numLeds = slot.fixture.config.numLeds;
            slot.buffer = new Float32Array(slot.numLeds * 3);
        } else {
            slot.behaviours = getChannelBlendBehaviours(slot.fixture);
            slot.numChannels = slot.behaviours.length;
            slot.buffer = new Float32Array(slot.numChannels);
        }
    }
}
