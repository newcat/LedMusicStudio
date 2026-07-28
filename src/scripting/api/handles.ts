import { Color } from "@/graph/colors";
import { scaleColorArray } from "@/utils";
import { DmxFixture, LedStripFixture } from "@/stage";
import type { LayerTarget } from "./layerTarget";

const BLACK: LMSColor = [0, 0, 0];

function copyColor(color: Color | LMSColor | undefined): LMSColor {
    return color ? [color[0], color[1], color[2]] : [...BLACK];
}

/**
 * Script-facing handle for an LED strip.
 *
 * Writes go into the layer of whichever source is currently running, not straight to the fixture. Anything the script does not
 * touch stays transparent, so a script painting three pixels composites over whatever is beneath it instead of blacking out the
 * other 57.
 */
export class LedStripHandle implements LMSLedStrip {
    public readonly type = "ledStrip";

    public constructor(
        private readonly fixture: LedStripFixture,
        private readonly target: LayerTarget
    ) {}

    public get id(): string {
        return this.fixture.id;
    }

    public get name(): string {
        return this.fixture.name;
    }

    public get length(): number {
        return this.fixture.config.numLeds;
    }

    /** Reads back this source's own write if there is one, otherwise the last committed frame. */
    public get(index: number): LMSColor {
        const layer = this.target.peekLedStripLayer(this.fixture);
        if (layer && index >= 0 && index < layer.alpha.length && layer.alpha[index] > 0) {
            return [layer.rgb[index * 3], layer.rgb[index * 3 + 1], layer.rgb[index * 3 + 2]];
        }
        return copyColor(this.fixture.value[index]);
    }

    public set(index: number, color: LMSColor): void {
        const layer = this.target.getLedStripLayer(this.fixture);
        if (!layer || index < 0 || index >= layer.alpha.length) {
            return;
        }
        layer.rgb[index * 3] = color[0];
        layer.rgb[index * 3 + 1] = color[1];
        layer.rgb[index * 3 + 2] = color[2];
        layer.alpha[index] = 1;
    }

    public fill(color: LMSColor): void {
        const layer = this.target.getLedStripLayer(this.fixture);
        if (!layer) {
            return;
        }
        for (let i = 0; i < layer.alpha.length; i++) {
            layer.rgb[i * 3] = color[0];
            layer.rgb[i * 3 + 1] = color[1];
            layer.rgb[i * 3 + 2] = color[2];
            layer.alpha[i] = 1;
        }
    }

    public setAll(colors: readonly LMSColor[]): void {
        const length = this.length;
        const scaled = colors.length === length ? colors : scaleColorArray(colors.length > 0 ? (colors as Color[]) : [BLACK], length);
        for (let i = 0; i < length; i++) {
            this.set(i, scaled[i] as LMSColor);
        }
    }

    /** Make this source cover the whole strip at `alpha`, so a fade can dip into the layers below. */
    public setOpacity(alpha: number): void {
        const layer = this.target.getLedStripLayer(this.fixture);
        if (!layer) {
            return;
        }
        for (let i = 0; i < layer.alpha.length; i++) {
            layer.alpha[i] = alpha;
        }
    }
}

/** Script-facing handle for a DMX fixture, addressing channels by the names from its fixture definition. */
export class DmxFixtureHandle implements LMSDmxFixture {
    public readonly type = "dmx";

    private readonly token = Symbol("DmxFixtureHandle");
    private channelNames: string[] | undefined;
    private channelIndices: Map<string, number> | undefined;

    public constructor(
        private readonly fixture: DmxFixture,
        private readonly target: LayerTarget
    ) {
        // channel names come from the fixture definition and mode, so they only change with the configuration
        this.fixture.events.configChanged.subscribe(this.token, () => {
            this.channelNames = undefined;
            this.channelIndices = undefined;
        });
    }

    public get id(): string {
        return this.fixture.id;
    }

    public get name(): string {
        return this.fixture.name;
    }

    public get channels(): readonly string[] {
        return (this.channelNames ??= this.fixture.channelNames);
    }

    public get(channel: string): number {
        const index = this.indexOf(channel);
        if (index < 0) {
            return 0;
        }
        const layer = this.target.peekDmxLayer(this.fixture);
        if (layer && layer.mask[index]) {
            return layer.channels[index];
        }
        return this.fixture.value[index] ?? 0;
    }

    public set(channel: string, value: number): void {
        this.setIndex(this.indexOf(channel), value);
    }

    public setChannels(values: Partial<Record<string, number>>): void {
        for (const [channel, value] of Object.entries(values)) {
            if (typeof value === "number") {
                this.set(channel, value);
            }
        }
    }

    public setValue(channel: number, value: number): void {
        this.setIndex(channel, value);
    }

    public dispose(): void {
        this.fixture.events.configChanged.unsubscribe(this.token);
    }

    private setIndex(index: number, value: number): void {
        const layer = this.target.getDmxLayer(this.fixture, this.channels.length);
        if (!layer || index < 0 || index >= layer.mask.length) {
            return;
        }
        layer.channels[index] = value;
        layer.mask[index] = 1;
    }

    private indexOf(channel: string): number {
        this.channelIndices ??= new Map(this.channels.map((name, i) => [name, i]));
        return this.channelIndices.get(channel) ?? -1;
    }
}

export type FixtureHandle = LedStripHandle | DmxFixtureHandle;

/**
 * Script-facing handle for a timeline track.
 *
 * This implements the widest declared shape, `LMSTrack`. The generated declarations narrow individual tracks to
 * `LMSAutomationTrack` or `LMSPatternTrack` based on the clips actually placed on them, and regenerate when that changes.
 */
export class TrackHandle implements LMSTrack {
    public constructor(
        public readonly id: string,
        private readonly getName: () => string,
        private readonly getValue: () => number | readonly LMSNote[] | undefined
    ) {}

    public get name(): string {
        return this.getName();
    }

    public get value(): number | readonly LMSNote[] | undefined {
        return this.getValue();
    }

    /** Satisfies `LMSPatternTrack`; empty for tracks that are not carrying notes right now. */
    public get notes(): readonly LMSNote[] {
        const value = this.getValue();
        return Array.isArray(value) ? (value as readonly LMSNote[]) : [];
    }
}
