import { LibraryItemType } from "@/library";
import { BaseFixture, DmxFixture, LedStripFixture } from "@/stage";
import type { Item, Track } from "@/timeline";

/**
 * Generates the `stage` and `tracks` declarations for the current project.
 *
 * This is what makes scripts environment-aware: the editor's TypeScript environment is handed a description of the fixtures and
 * tracks that actually exist, so referring to one that has been renamed or deleted is an error while you are editing rather
 * than an exception during playback. It is regenerated whenever the project changes.
 *
 * Keys are the exact fixture and track names rather than sanitised identifiers, so what you type in a script matches what you
 * see in the UI and a rename maps one-to-one onto a rename refactoring.
 */
export function generateStageDeclarations(fixtures: readonly BaseFixture[], tracks: readonly Track[], items: readonly Item[]): string {
    return [
        "// Generated from the current project. Do not edit — your changes will be overwritten.",
        "",
        generateStage(fixtures),
        "",
        generateTracks(tracks, items),
        "",
    ].join("\n");
}

function generateStage(fixtures: readonly BaseFixture[]): string {
    const { unique, duplicated } = partitionByName(fixtures, (f) => f.name);

    const lines = ["/** Fixtures on the stage, by name. */", "declare const stage: {"];
    for (const fixture of unique) {
        lines.push(indent(docComment(describeFixture(fixture))));
        lines.push(indent(`readonly ${JSON.stringify(fixture.name)}: ${fixtureType(fixture)};`));
    }
    for (const name of duplicated) {
        lines.push(indent(`// ${JSON.stringify(name)} is not available: more than one fixture has this name.`));
    }
    lines.push("};");
    return lines.join("\n");
}

function generateTracks(tracks: readonly Track[], items: readonly Item[]): string {
    const { unique, duplicated } = partitionByName(tracks, (t) => t.name);

    const lines = ["/** Timeline tracks, by name. */", "declare const tracks: {"];
    for (const track of unique) {
        const kind = trackKind(track, items);
        lines.push(indent(docComment(describeTrackKind(kind))));
        lines.push(indent(`readonly ${JSON.stringify(track.name)}: ${TRACK_TYPES[kind]};`));
    }
    for (const name of duplicated) {
        lines.push(indent(`// ${JSON.stringify(name)} is not available: more than one track has this name.`));
    }
    lines.push("};");
    return lines.join("\n");
}

/**
 * Names shared by several fixtures or tracks are omitted rather than resolved to an arbitrary one. Ambiguity is the real
 * problem, so the generated file names it and lets the reference fail.
 */
function partitionByName<T>(entries: readonly T[], getName: (entry: T) => string): { unique: T[]; duplicated: string[] } {
    const counts = new Map<string, number>();
    for (const entry of entries) {
        const name = getName(entry);
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return {
        unique: entries.filter((e) => counts.get(getName(e)) === 1),
        duplicated: [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name),
    };
}

function fixtureType(fixture: BaseFixture): string {
    if (fixture instanceof LedStripFixture) {
        return `LMSLedStrip<${fixture.config.numLeds}>`;
    } else if (fixture instanceof DmxFixture) {
        const channels = fixture.channelNames;
        // an unconfigured fixture has no channels; `never` makes every set() call fail with the doc comment as the explanation
        const union = channels.length > 0 ? channels.map((c) => JSON.stringify(c)).join(" | ") : "never";
        return `LMSDmxFixture<${union}>`;
    }
    return "LMSFixture";
}

function describeFixture(fixture: BaseFixture): string {
    if (fixture instanceof LedStripFixture) {
        return `LED Strip · ${fixture.config.numLeds} LEDs`;
    } else if (fixture instanceof DmxFixture) {
        const { definition, mode, startChannel } = fixture.config;
        if (!definition || !mode) {
            return "DMX · not configured yet — pick a fixture definition and mode in the stage editor";
        }
        const channelCount = fixture.channelNames.length;
        return `DMX · ${definition.name} · mode ${JSON.stringify(mode.name)} · channels ${startChannel}-${startChannel + channelCount - 1}`;
    }
    return "Fixture";
}

type TrackKind = "automation" | "pattern" | "unknown";

const TRACK_TYPES: Record<TrackKind, string> = {
    automation: "LMSAutomationTrack",
    pattern: "LMSPatternTrack",
    unknown: "LMSTrack",
};

/**
 * A track has no declared type of its own — what it produces depends on the clips placed on it. Tracks carrying only one kind
 * of clip get the precise type; anything mixed or still empty falls back to the union.
 */
function trackKind(track: Track, items: readonly Item[]): TrackKind {
    const types = new Set(items.filter((i) => i.trackId === track.id).map((i) => i.libraryItem.type));
    types.delete(LibraryItemType.AUDIO);
    types.delete(LibraryItemType.GRAPH);
    types.delete(LibraryItemType.SCRIPT);
    types.delete(LibraryItemType.SCRIPT_LIBRARY);

    if (types.size !== 1) {
        return "unknown";
    } else if (types.has(LibraryItemType.AUTOMATION)) {
        return "automation";
    } else if (types.has(LibraryItemType.PATTERN)) {
        return "pattern";
    }
    return "unknown";
}

function describeTrackKind(kind: TrackKind): string {
    switch (kind) {
        case "automation":
            return "Automation";
        case "pattern":
            return "Note pattern";
        default:
            return "Mixed or empty — place only automation clips or only note patterns on a track to get a precise type";
    }
}

function docComment(text: string): string {
    return `/** ${text} */`;
}

function indent(text: string): string {
    return text
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
}
