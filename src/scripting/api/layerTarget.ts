import { createDmxLayer, createLedStripLayer, DmxFixture, DmxLayer, LayerSet, LedStripFixture, LedStripLayer } from "@/stage";

/**
 * Where a script's fixture writes land.
 *
 * Handles are shared across every script — they are cached per fixture — so they cannot own a layer themselves. Instead the
 * runtime opens a layer set before each source runs and the handles write into whichever one is currently open. A write with no
 * open source (from `activate()`, say, which runs outside the frame) is dropped rather than leaking into another source's layer.
 */
export class LayerTarget {
    private active: LayerSet | undefined;
    private suppressed = false;

    public begin(): void {
        this.active = new Map();
        this.suppressed = false;
    }

    /**
     * Silence writes while a sequence replays.
     *
     * Seeking backwards restarts a sequence and runs it forward again, and every one of those catch-up ticks would otherwise
     * paint into the frame being built — a chase seeked to tick 2 would light pixels 0, 1 *and* 2. Only the tick actually being
     * displayed draws; the rest just advance the generator's state.
     */
    public setSuppressed(suppressed: boolean): void {
        this.suppressed = suppressed;
    }

    /** Hand over the layers written since `begin()` and close the source. */
    public take(): LayerSet {
        const layers = this.active ?? new Map();
        this.active = undefined;
        return layers;
    }

    public get isOpen(): boolean {
        return this.active !== undefined;
    }

    public getLedStripLayer(fixture: LedStripFixture): LedStripLayer | undefined {
        if (!this.active || this.suppressed) {
            return undefined;
        }
        const existing = this.active.get(fixture.id);
        if (existing?.type === fixture.type) {
            return existing;
        }
        const layer = createLedStripLayer(fixture.config.numLeds);
        this.active.set(fixture.id, layer);
        return layer;
    }

    public getDmxLayer(fixture: DmxFixture, channelCount: number): DmxLayer | undefined {
        if (!this.active || this.suppressed) {
            return undefined;
        }
        const existing = this.active.get(fixture.id);
        if (existing?.type === fixture.type) {
            return existing;
        }
        const layer = createDmxLayer(channelCount);
        this.active.set(fixture.id, layer);
        return layer;
    }

    public peekLedStripLayer(fixture: LedStripFixture): LedStripLayer | undefined {
        const layer = this.suppressed ? undefined : this.active?.get(fixture.id);
        return layer?.type === fixture.type ? layer : undefined;
    }

    public peekDmxLayer(fixture: DmxFixture): DmxLayer | undefined {
        const layer = this.suppressed ? undefined : this.active?.get(fixture.id);
        return layer?.type === fixture.type ? layer : undefined;
    }
}
