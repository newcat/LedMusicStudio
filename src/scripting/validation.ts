import { BaseFixture } from "@/stage";
import type { Item } from "@/timeline";
import { ScriptLibraryItem } from "./script.libraryItem";

export interface ScriptProblem {
    scriptId: string;
    severity: "error" | "note";
    message: string;
}

/**
 * Checks compiled scripts against the project without running them.
 *
 * This is the load-time half of being environment-aware. Editing-time diagnostics only help while the editor is open, so a
 * project opened after a fixture was deleted would otherwise reach playback before anything went wrong. The `uses` manifest is
 * what makes this possible: it says which fixtures a sequence drives before a single tick has run.
 */
export function validateScripts(
    scripts: readonly ScriptLibraryItem[],
    fixtures: ReadonlyMap<string, BaseFixture>,
    items: readonly Item[]
): ScriptProblem[] {
    const problems: ScriptProblem[] = [];

    for (const script of scripts) {
        for (const key of script.missingDeclarations) {
            problems.push({
                scriptId: script.id,
                severity: "error",
                message: `Declares "${key}" in uses, but the fixture it referred to no longer exists.`,
                });
        }
        for (const [key, fixtureId] of script.declaredFixtures) {
            if (!fixtures.has(fixtureId)) {
                problems.push({
                    scriptId: script.id,
                    severity: "error",
                    message: `Declares "${key}" in uses, but that fixture has been removed from the stage.`,
                });
            }
        }
    }

    problems.push(...findOverlaps(scripts, fixtures, items));
    return problems;
}

/**
 * Reports scripts that drive the same fixture at the same time.
 *
 * Not an error — layers composite, so this is well defined — but where two opaque layers overlap the lower one is doing work
 * nobody sees, which is almost always a surprise rather than an intention.
 */
function findOverlaps(
    scripts: readonly ScriptLibraryItem[],
    fixtures: ReadonlyMap<string, BaseFixture>,
    items: readonly Item[]
): ScriptProblem[] {
    const problems: ScriptProblem[] = [];
    const byScript = new Map(scripts.map((s) => [s.id, s]));

    // only scripts whose timeline items actually overlap can contend for a fixture
    const placements = items
        .filter((i) => byScript.has(i.libraryItem.id))
        .map((i) => ({ item: i, script: byScript.get(i.libraryItem.id)! }));

    for (let a = 0; a < placements.length; a++) {
        for (let b = a + 1; b < placements.length; b++) {
            const first = placements[a];
            const second = placements[b];
            if (first.script.id === second.script.id || first.item.start >= second.item.end || second.item.start >= first.item.end) {
                continue;
            }

            const shared = [...first.script.declaredFixtures.values()].filter(
                (id) => fixtures.has(id) && [...second.script.declaredFixtures.values()].includes(id)
            );
            for (const fixtureId of shared) {
                const name = fixtures.get(fixtureId)!.name;
                problems.push({
                    scriptId: first.script.id,
                    severity: "note",
                    message: `Also driven by "${second.script.name}" on "${name}" at the same time; the higher track wins where both write.`,
                });
            }
        }
    }

    return problems;
}
