/**
 * Programming processor (feature 004, research R4): turns the active timeline items of a frame into contributions,
 * merges them with the engine and applies the result to every DMX fixture. Called once per frame by
 * `BaseTimelineProcessor.process()` in place of the old whole-fixture writes for DMX fixtures.
 */

import { reactive } from "vue";
import { useTimeline, type Item } from "@/timeline";
import type { AttributeKey, AttributeValues } from "./attributes";
import { mergeFrame } from "./engine";
import { dmxFixtures, getProgrammingContext } from "./profile";
import { decodeTarget, effectiveTarget, resolveTarget } from "./targets";
import type { Contribution, FrameResult, ItemContext, Priority, ResolvedFixture, ResolvedTarget, Target } from "./types";
import { programmingTimings } from "./debug";
import { isEffectLibraryItem, isLookLibraryItem } from "./guards";
import { evaluateEffect } from "./effects";
import { evaluateLook, type LookLookups } from "./looks";
import { lookLookups } from "./lookLookups";

/** Raw DMX output node result (all channels of one fixture). */
export interface GraphRawOutput {
    fixtureId: string;
    data: number[];
}

/** Attribute Output node result. `target` is "clip", "group:<id>" or "fixture:<id>". */
export interface GraphAttributeOutput {
    target: string;
    attributes: AttributeValues;
}

/** One evaluation of a graph; per-fixture graphs run once per fixture of their target (R7). */
export interface GraphRun {
    /** The fixture of a per-fixture run; null for a single run. */
    fixture: ResolvedFixture | null;
    raw: GraphRawOutput[];
    attributes: GraphAttributeOutput[];
}

/** itemId → warnings, shown as a badge on the timeline item. */
export const programmingWarnings = reactive(new Map<string, string[]>());

/** Target of an Attribute Output node: "clip" uses the item's target. */
export function attributeOutputTarget(item: Item, target: string): Target | null {
    return target === "clip" || !target ? effectiveTarget(item) : decodeTarget(target);
}

function priorityOf(item: Item, trackIndex: Map<string, number>): Priority {
    return [trackIndex.get(item.trackId) ?? -1, item.start];
}

function addWarnings(map: Map<string, string[]>, itemId: string, warnings: readonly string[]): void {
    if (warnings.length === 0) {
        return;
    }
    const list = map.get(itemId) ?? [];
    for (const w of warnings) {
        if (!list.includes(w)) {
            list.push(w);
        }
    }
    map.set(itemId, list);
}

function attributeContribution(fixtureId: string, priority: Priority, attributes: AttributeValues): Contribution {
    const contribution: Contribution = { fixtureId, priority, attributes: {}, raw: null };
    for (const key of Object.keys(attributes) as AttributeKey[]) {
        const value = attributes[key];
        if (value !== undefined) {
            contribution.attributes[key] = { value, mode: "absolute", weight: 1 };
        }
    }
    return contribution;
}

function graphContributions(item: Item, priority: Priority, runs: readonly GraphRun[], warnings: Map<string, string[]>): Contribution[] {
    const result: Contribution[] = [];
    runs.forEach((run, runIndex) => {
        // raw DMX outputs of per-fixture graphs: first run only (R7)
        if (runIndex === 0) {
            for (const raw of run.raw) {
                const context = getProgrammingContext(raw.fixtureId);
                if (!context) {
                    continue;
                }
                const map = new Map<number, number>();
                for (let i = 0; i < context.profile.channelCount; i++) {
                    // unset inputs are 0, as before feature 004
                    map.set(i, raw.data[i] ?? 0);
                }
                result.push({ fixtureId: raw.fixtureId, priority, attributes: {}, raw: map });
            }
        }
        for (const output of run.attributes) {
            const resolved = resolveTarget(attributeOutputTarget(item, output.target));
            addWarnings(warnings, item.id, resolved.warnings);
            const fixtures = run.fixture ? resolved.fixtures.filter((f) => f.fixtureId === run.fixture!.fixtureId) : resolved.fixtures;
            for (const f of fixtures) {
                result.push(attributeContribution(f.fixtureId, priority, output.attributes));
            }
        }
    });
    return result;
}

function itemContext(item: Item, unit: number, priority: Priority, target: ResolvedTarget): ItemContext {
    return {
        itemId: item.id,
        priority,
        localPosition: unit - item.start,
        length: item.end - item.start,
        fadeIn: item.fadeIn,
        fadeOut: item.fadeOut,
        target,
    };
}

/**
 * Builds the contributions of all active items, merges them and applies the values to every DMX fixture.
 * `graphRuns` holds the outputs of the graph items evaluated this frame.
 */
export function processProgramming(activeItems: readonly Item[], unit: number, graphRuns: ReadonlyMap<Item, GraphRun[]>): FrameResult {
    const started = performance.now();
    const timeline = useTimeline();
    const trackIndex = new Map<string, number>();
    timeline.tracks.forEach((t, i) => trackIndex.set(t.id, i));

    const warnings = new Map<string, string[]>();
    const contributions: Contribution[] = [];
    const lookups: LookLookups = lookLookups();

    for (const item of activeItems) {
        const priority = priorityOf(item, trackIndex);
        const runs = graphRuns.get(item);
        if (runs) {
            contributions.push(...graphContributions(item, priority, runs, warnings));
            continue;
        }
        const library = item.libraryItem;
        if (isEffectLibraryItem(library)) {
            const target = resolveTarget(effectiveTarget(item));
            addWarnings(warnings, item.id, target.warnings);
            contributions.push(...evaluateEffect(library.state, itemContext(item, unit, priority, target), (id) => getProgrammingContext(id)?.profile ?? null));
        } else if (isLookLibraryItem(library)) {
            const target = resolveTarget(effectiveTarget(item));
            addWarnings(warnings, item.id, target.warnings);
            const ctx = itemContext(item, unit, priority, target);
            const lookWarnings: string[] = [];
            contributions.push(...evaluateLook(library.state, ctx, lookups, lookWarnings));
            addWarnings(warnings, item.id, lookWarnings);
        }
    }

    const fixtures = dmxFixtures();
    const values = mergeFrame(
        contributions,
        fixtures.map((f) => f.id),
        (id) => getProgrammingContext(id)
    );
    for (const fixture of fixtures) {
        const v = values.get(fixture.id);
        if (v) {
            fixture.setValue(v);
        } else {
            // not configured (no definition/mode): no channels to program
            fixture.resetValue();
        }
    }

    updateWarnings(warnings);
    programmingTimings.engine = performance.now() - started;
    return { values, warnings };
}

/** Updates the reactive warning map only where something changed (it is read by every timeline item). */
function updateWarnings(next: Map<string, string[]>): void {
    for (const id of Array.from(programmingWarnings.keys())) {
        if (!next.has(id)) {
            programmingWarnings.delete(id);
        }
    }
    for (const [id, list] of next) {
        const current = programmingWarnings.get(id);
        if (!current || current.join("\n") !== list.join("\n")) {
            programmingWarnings.set(id, list);
        }
    }
}
