/**
 * Timeline clipboard layout (feature 005, research R10, data-model "Clipboard"). Pure: entries keep the copied set's
 * spacing in time and across tracks.
 */

import type { IItemState } from "./item";

export interface ClipboardEntry {
    state: IItemState;
    /** start − earliest start of the copied set */
    dt: number;
    /** track index − topmost track index of the copied set */
    dTrack: number;
}

export function buildEntries(items: ReadonlyArray<{ state: IItemState; trackIndex: number }>): ClipboardEntry[] {
    if (items.length === 0) {
        return [];
    }
    const minStart = Math.min(...items.map((i) => i.state.start));
    const minTrack = Math.min(...items.map((i) => i.trackIndex));
    return items.map((i) => ({ state: i.state, dt: i.state.start - minStart, dTrack: i.trackIndex - minTrack }));
}

export function layoutEntries(
    entries: readonly ClipboardEntry[],
    baseTick: number,
    baseTrackIndex: number
): Array<{ start: number; end: number; trackIndex: number; state: IItemState }> {
    return entries.map((e) => {
        const start = baseTick + e.dt;
        return { start, end: start + (e.state.end - e.state.start), trackIndex: baseTrackIndex + e.dTrack, state: e.state };
    });
}
