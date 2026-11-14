/**
 * Dev console helper (feature 004, R12): `programming.debug()` prints the per-frame timings and, for a fixture,
 * its merged attribute values and DMX output. `programming.debug("<fixture name or id>")`.
 */

import { ATTRIBUTE_KEYS, type AttributeValueMap } from "./attributes";
import { lastFold } from "./engine";
import { dmxFixtures, getProgrammingContext } from "./profile";

/** Timings of the last frame in ms (set by BaseTimelineProcessor and the processor). */
export const programmingTimings = {
    /** All graph runs of the frame. */
    graphs: 0,
    /** Number of graph evaluations (per-fixture graphs count once per fixture). */
    graphRuns: 0,
    /** Contributions, merge, encode and setValue. */
    engine: 0,
};

function format(key: keyof AttributeValueMap, values: AttributeValueMap): string {
    const v = values[key];
    if (key === "color") {
        return (v as number[]).map((c) => c.toFixed(3)).join(", ");
    }
    if (key === "shutter") {
        const s = v as AttributeValueMap["shutter"];
        return s.mode === "strobe" ? `strobe ${s.rate} Hz` : s.mode;
    }
    return typeof v === "number" ? String(Math.round(v * 1000) / 1000) : String(v);
}

export function debug(fixture?: string): void {
    console.log(
        `[programming] graphs ${programmingTimings.graphs.toFixed(2)} ms (${programmingTimings.graphRuns} runs), engine ${programmingTimings.engine.toFixed(2)} ms`
    );
    if (fixture === undefined) {
        console.log("[programming] pass a fixture name or id for its attributes and DMX output, e.g. programming.debug(\"Head 1\")");
        return;
    }
    const match = dmxFixtures().find((f) => f.id === fixture || f.name === fixture);
    if (!match) {
        console.log(`[programming] no DMX fixture "${fixture}"`);
        return;
    }
    const context = getProgrammingContext(match.id);
    const fold = lastFold.get(match.id);
    if (!context || !fold) {
        console.log(`[programming] "${match.name}" has no programming data yet (no definition/mode, or not played)`);
        return;
    }
    const rows = ATTRIBUTE_KEYS.filter((k) => context.profile.supported.has(k)).map((key) => ({
        attribute: key,
        value: format(key, fold.values),
        source: fold.writers[key] ? `track ${fold.writers[key]![0]} @ ${fold.writers[key]![1]}` : context.profile.overridden.has(key) ? "fixture default" : "default",
    }));
    console.table(rows);
    console.log(`[programming] DMX ${match.name}:`, match.value.join(" "));
    console.log(`[programming] pan/tilt ${context.profile.panTiltNormalized ? "normalized 0–1" : "degrees"}`);
}

if (typeof window !== "undefined") {
    (window as unknown as { programming?: { debug: typeof debug; timings: typeof programmingTimings } }).programming = {
        debug,
        timings: programmingTimings,
    };
}
