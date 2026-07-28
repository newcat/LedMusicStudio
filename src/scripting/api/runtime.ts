import { INote } from "@/pattern";
import { BaseFixture, DmxFixture, LayerSet, LedStripFixture, useStage } from "@/stage";
import { useTimeline } from "@/timeline";
import { DmxFixtureHandle, FixtureHandle, LedStripHandle, TrackHandle } from "./handles";
import { LayerTarget } from "./layerTarget";
import type { WriteGate } from "../sequence";

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

    private readonly target = new LayerTarget();
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

    /** Called once per tick, before any source runs. */
    public beginTick(trackValues: ReadonlyMap<string, number | INote[]>): void {
        this.trackValues = trackValues;
        this.prune();
    }

    /** Open a layer set for one script item. Everything it writes goes here until `endSource`. */
    public beginSource(): void {
        this.target.begin();
    }

    /** Close the current script item and hand its layers to the compositor. */
    public endSource(): LayerSet {
        return this.target.take();
    }

    /** Used by sequences to silence writes from replayed ticks. */
    public get writeGate(): WriteGate {
        return this.target;
    }

    /** Resolve the fixtures a compiled sequence declared in `uses`, so the app knows what it drives without running it. */
    public resolveDeclaredFixtures(uses: Record<string, unknown> | undefined): { declared: Map<string, string>; missing: string[] } {
        const declared = new Map<string, string>();
        const missing: string[] = [];
        for (const [key, value] of Object.entries(uses ?? {})) {
            if (value instanceof LedStripHandle || value instanceof DmxFixtureHandle) {
                declared.set(key, value.id);
            } else if (value === undefined || value === null) {
                missing.push(key);
            }
        }
        return { declared, missing };
    }

    /** Drop handles for fixtures that no longer exist. */
    public prune(): void {
        const stage = useStage();
        for (const [id, handle] of this.fixtureHandles) {
            if (!stage.fixtures.has(id)) {
                if (handle instanceof DmxFixtureHandle) {
                    handle.dispose();
                }
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

        let handle: FixtureHandle | undefined;
        if (fixture instanceof LedStripFixture) {
            handle = new LedStripHandle(fixture, this.target);
        } else if (fixture instanceof DmxFixture) {
            handle = new DmxFixtureHandle(fixture, this.target);
        }
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

/**
 * Deliberately keyed on `globalThis` rather than being a plain module-level constant.
 *
 * Fixture handles capture the runtime's layer target when they are created. If this module is ever evaluated twice — which is
 * exactly what a hot reload does when one of these files is edited with the dev server running — handles end up writing to one
 * target while the processor opens and reads another, and every script silently stops producing output until the server is
 * restarted. Pinning the instance globally makes that failure impossible to reproduce.
 */
const RUNTIME_KEY = Symbol.for("lms.scriptRuntime");

interface RuntimeHolder {
    [RUNTIME_KEY]?: ScriptRuntime;
}

const holder = globalThis as RuntimeHolder;
export const scriptRuntime: ScriptRuntime = (holder[RUNTIME_KEY] ??= new ScriptRuntime());
