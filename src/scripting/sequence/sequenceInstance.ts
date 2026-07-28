import { TICKS_PER_BEAT } from "@/constants";
import { clamp, secondsToUnits } from "@/utils";
import { Flow } from "./flow";
import { createSeededRandom, SeededRandom } from "./random";

export interface SequenceDefinition {
    uses?: Record<string, unknown>;
    run(context: never): Flow;
}

/** Marks the object returned by `defineSequence` so a compiled script can be told apart from a plain `LMSScript` class. */
export const SEQUENCE_MARKER = "__lmsSequence";

export interface MarkedSequenceDefinition extends SequenceDefinition {
    [SEQUENCE_MARKER]: true;
}

export function defineSequence(definition: SequenceDefinition): MarkedSequenceDefinition {
    return { ...definition, [SEQUENCE_MARKER]: true };
}

export function isSequenceDefinition(value: unknown): value is MarkedSequenceDefinition {
    return typeof value === "object" && value !== null && (value as Record<string, unknown>)[SEQUENCE_MARKER] === true;
}

export interface SequenceTickInfo {
    data: LMSCalculationData;
    /** Length of the timeline item in ticks, for `progress`. */
    itemLength: number;
    bpm: number;
}

/** Lets the runtime silence fixture writes while a sequence is catching up to the tick actually being displayed. */
export interface WriteGate {
    setSuppressed(suppressed: boolean): void;
}

/**
 * A running sequence.
 *
 * Generators cannot be cloned, so there is no way to snapshot one and jump to an arbitrary point. Seeking backwards therefore
 * restarts the sequence and replays it forward, which is the same approach Motion Canvas takes. Replay is cheap because a
 * sequence's only effect is what it writes into the current frame — at 24 ticks per beat a 32 bar item is roughly 3000 steps.
 *
 * One consequence worth knowing: replayed ticks see the *current* tick's audio and track data, because past frames are gone. A
 * sequence driven by time replays exactly; one that branches on audio may take a different path after a seek.
 */
export class SequenceInstance {
    private root: Flow | undefined;
    private background: Flow[] = [];
    private lastTick = -1;
    private finished = false;
    private random: SeededRandom;
    private tickInfo: SequenceTickInfo | undefined;
    private readonly context: Record<string, unknown>;

    public constructor(
        private readonly definition: SequenceDefinition,
        private readonly seed: number,
        private readonly gate?: WriteGate
    ) {
        this.random = createSeededRandom(seed);
        this.context = this.createContext();
    }

    public get currentTick(): number {
        return this.lastTick;
    }

    public get isFinished(): boolean {
        return this.finished;
    }

    /** Advance to `localTick` (ticks since the start of the timeline item), replaying from the start if that means going back. */
    public advanceTo(localTick: number, info: SequenceTickInfo): void {
        this.tickInfo = info;
        if (localTick < this.lastTick) {
            this.reset();
        }
        try {
            while (this.lastTick < localTick) {
                this.lastTick++;
                // only the tick being displayed draws; the ones before it just bring the generator up to date
                this.gate?.setSuppressed(this.lastTick !== localTick);
                this.step();
            }
        } finally {
            this.gate?.setSuppressed(false);
        }
    }

    public reset(): void {
        this.root = undefined;
        this.background = [];
        this.lastTick = -1;
        this.finished = false;
        this.random = createSeededRandom(this.seed);
    }

    private step(): void {
        if (!this.finished) {
            this.root ??= this.definition.run(this.context as never);
            if (this.root.next().done) {
                this.finished = true;
            }
        }
        if (this.background.length > 0) {
            this.background = this.background.filter((flow) => !flow.next().done);
        }
    }

    private createContext(): Record<string, unknown> {
        const context: Record<string, unknown> = { ...(this.definition.uses ?? {}) };

        Object.defineProperties(context, {
            tick: { get: () => this.lastTick, enumerable: true },
            beats: { get: () => this.lastTick / TICKS_PER_BEAT, enumerable: true },
            progress: {
                get: () => clamp(this.lastTick / Math.max(1, this.tickInfo?.itemLength ?? 1), 0, 1),
                enumerable: true,
            },
            data: { get: () => this.tickInfo?.data, enumerable: true },
        });

        context.random = () => this.random.next();
        context.randomInt = (minInclusive: number, maxExclusive: number) =>
            Math.floor(this.random.next() * (maxExclusive - minInclusive)) + minInclusive;
        context.noise = (x: number, y = 0) => this.random.noise2D(x, y);
        context.seconds = (value: number) => secondsToUnits(value, this.tickInfo?.bpm ?? 130);
        context.spawn = (flow: Flow) => {
            this.background.push(flow);
        };

        return context;
    }
}
