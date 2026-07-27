import { INote } from "@/pattern";
import { BaseFixture, DmxFixture, LedStripFixture, useStage } from "@/stage";
import { useTimeline } from "@/timeline";
import { DmxFixtureHandle, FixtureHandle, LedStripHandle, TrackHandle } from "./handles";

function createHandle(fixture: BaseFixture): FixtureHandle | undefined {
    if (fixture instanceof LedStripFixture) {
        return new LedStripHandle(fixture);
    } else if (fixture instanceof DmxFixture) {
        return new DmxFixtureHandle(fixture);
    }
    return undefined;
}

/**
 * Backs the `stage` and `tracks` globals that scripts see.
 *
 * Both are proxies that resolve by name on every access rather than objects rebuilt whenever the project changes: a rename or a
 * deletion needs no invalidation bookkeeping, and a name that no longer exists simply reads as `undefined` — which the
 * generated declarations have already turned into an editing-time error anyway.
 */
export class ScriptRuntime {
    public readonly stage: Record<string, FixtureHandle | undefined>;
    public readonly tracks: Record<string, TrackHandle | undefined>;

    private readonly fixtureHandles = new Map<string, FixtureHandle>();
    private readonly trackHandles = new Map<string, TrackHandle>();
    private trackValues: ReadonlyMap<string, number | INote[]> = new Map();

    public constructor() {
        this.stage = new Proxy(Object.create(null) as Record<string, FixtureHandle | undefined>, {
            get: (_target, property) => (typeof property === "string" ? this.getFixtureByName(property) : undefined),
            has: (_target, property) => typeof property === "string" && this.getFixtureByName(property) !== undefined,
            ownKeys: () => this.getFixtures().map((f) => f.name),
            getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
        });

        this.tracks = new Proxy(Object.create(null) as Record<string, TrackHandle | undefined>, {
            get: (_target, property) => (typeof property === "string" ? this.getTrackByName(property) : undefined),
            has: (_target, property) => typeof property === "string" && this.getTrackByName(property) !== undefined,
            ownKeys: () => useTimeline().tracks.map((t) => t.name),
            getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
        });
    }

    /** Called once per tick, before any script runs. */
    public beginTick(trackValues: ReadonlyMap<string, number | INote[]>): void {
        this.trackValues = trackValues;
        this.prune();
    }

    /** Called once per tick, after every script has run, to write buffered fixture changes out in one go. */
    public flush(): void {
        for (const handle of this.fixtureHandles.values()) {
            handle.flush();
        }
    }

    /** Drop handles for fixtures that no longer exist. */
    public prune(): void {
        const stage = useStage();
        for (const [id, handle] of this.fixtureHandles) {
            if (!stage.fixtures.has(id)) {
                handle.dispose();
                this.fixtureHandles.delete(id);
            }
        }
    }

    private getFixtures(): BaseFixture[] {
        return Array.from(useStage().fixtures.values());
    }

    private getFixtureByName(name: string): FixtureHandle | undefined {
        const matches = this.getFixtures().filter((f) => f.name === name);
        // an ambiguous name is not resolvable; the generated declarations report the collision instead of guessing
        if (matches.length !== 1) {
            return undefined;
        }
        return this.getFixtureHandle(matches[0]);
    }

    private getFixtureHandle(fixture: BaseFixture): FixtureHandle | undefined {
        const existing = this.fixtureHandles.get(fixture.id);
        if (existing) {
            return existing;
        }
        const handle = createHandle(fixture);
        if (handle) {
            this.fixtureHandles.set(fixture.id, handle);
        }
        return handle;
    }

    private getTrackByName(name: string): TrackHandle | undefined {
        const matches = useTimeline().tracks.filter((t) => t.name === name);
        if (matches.length !== 1) {
            return undefined;
        }

        const track = matches[0];
        let handle = this.trackHandles.get(track.id);
        if (!handle) {
            handle = new TrackHandle(
                track.id,
                () => useTimeline().getTrackById(track.id)?.name ?? name,
                () => this.trackValues.get(track.id)
            );
            this.trackHandles.set(track.id, handle);
        }
        return handle;
    }
}

export const scriptRuntime = new ScriptRuntime();
