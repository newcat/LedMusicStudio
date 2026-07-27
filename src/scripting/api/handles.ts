import { Color } from "@/graph/colors";
import { scaleColorArray } from "@/utils";
import { DmxFixture, LedStripFixture } from "@/stage";

const BLACK: LMSColor = [0, 0, 0];

function copyColor(color: Color | LMSColor | undefined): LMSColor {
    return color ? [color[0], color[1], color[2]] : [...BLACK];
}

interface Flushable {
    flush(): void;
    dispose(): void;
}

/**
 * Script-facing handle for an LED strip.
 *
 * Writes go into a working buffer that is flushed to the fixture once per tick rather than straight through to
 * `fixture.setValue`, which reallocates and rescales the whole array on every call — painting a strip pixel by pixel through
 * that would be quadratic.
 */
export class LedStripHandle implements LMSLedStrip, Flushable {
    public readonly type = "ledStrip";

    private buffer: LMSColor[] | undefined;

    public constructor(private readonly fixture: LedStripFixture) {}

    public get id(): string {
        return this.fixture.id;
    }

    public get name(): string {
        return this.fixture.name;
    }

    public get length(): number {
        return this.fixture.config.numLeds;
    }

    public get(index: number): LMSColor {
        if (this.buffer) {
            return copyColor(this.buffer[index]);
        }
        return copyColor(this.fixture.value[index]);
    }

    public set(index: number, color: LMSColor): void {
        const buffer = this.ensureBuffer();
        if (index >= 0 && index < buffer.length) {
            buffer[index] = copyColor(color);
        }
    }

    public fill(color: LMSColor): void {
        const buffer = this.ensureBuffer();
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = copyColor(color);
        }
    }

    public setAll(colors: readonly LMSColor[]): void {
        const length = this.length;
        const scaled = colors.length === length ? colors : scaleColorArray(colors.length > 0 ? (colors as Color[]) : [BLACK], length);
        const buffer = this.ensureBuffer();
        for (let i = 0; i < length; i++) {
            buffer[i] = copyColor(scaled[i]);
        }
    }

    public flush(): void {
        if (this.buffer) {
            this.fixture.setValue(this.buffer as Color[]);
            this.buffer = undefined;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public dispose(): void {}

    /** Seeded from the fixture's current value so a script that writes one pixel leaves the rest of the frame intact. */
    private ensureBuffer(): LMSColor[] {
        if (!this.buffer) {
            const length = this.length;
            const current = this.fixture.value;
            this.buffer = new Array<LMSColor>(length);
            for (let i = 0; i < length; i++) {
                this.buffer[i] = copyColor(current[i]);
            }
        }
        return this.buffer;
    }
}

/** Script-facing handle for a DMX fixture, addressing channels by the names from its fixture definition. */
export class DmxFixtureHandle implements LMSDmxFixture, Flushable {
    public readonly type = "dmx";

    private readonly token = Symbol("DmxFixtureHandle");
    private buffer: number[] | undefined;
    private channelNames: string[] | undefined;
    private channelIndices: Map<string, number> | undefined;

    public constructor(private readonly fixture: DmxFixture) {
        // channel names are derived from the fixture definition and mode, so they only change with the configuration
        this.fixture.events.configChanged.subscribe(this.token, () => {
            this.channelNames = undefined;
            this.channelIndices = undefined;
            this.buffer = undefined;
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
        return (this.buffer ?? this.fixture.value)[index] ?? 0;
    }

    public set(channel: string, value: number): void {
        const index = this.indexOf(channel);
        if (index >= 0) {
            this.ensureBuffer()[index] = value;
        }
    }

    public setChannels(values: Partial<Record<string, number>>): void {
        for (const [channel, value] of Object.entries(values)) {
            if (typeof value === "number") {
                this.set(channel, value);
            }
        }
    }

    public setValue(channel: number, value: number): void {
        const buffer = this.ensureBuffer();
        if (channel >= 0 && channel < buffer.length) {
            buffer[channel] = value;
        }
    }

    public flush(): void {
        if (this.buffer) {
            this.fixture.setValue(this.buffer);
            this.buffer = undefined;
        }
    }

    public dispose(): void {
        this.fixture.events.configChanged.unsubscribe(this.token);
    }

    private indexOf(channel: string): number {
        this.channelIndices ??= new Map(this.channels.map((name, i) => [name, i]));
        return this.channelIndices.get(channel) ?? -1;
    }

    private ensureBuffer(): number[] {
        if (!this.buffer) {
            const length = this.channels.length;
            const current = this.fixture.value;
            this.buffer = new Array<number>(length);
            for (let i = 0; i < length; i++) {
                this.buffer[i] = current[i] ?? 0;
            }
        }
        return this.buffer;
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
