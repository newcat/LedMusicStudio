/**
 * Use counts for delete confirmations (feature 004): groups used by timeline items/tracks, presets used by looks,
 * aim targets used by looks and position presets. Reads the library and timeline stores.
 */

import { useLibrary } from "@/library/libraryModel";
import { useTimeline } from "@/timeline/model/editor";
import { isLookLibraryItem, isPresetLibraryItem } from "./guards";
import type { LookLibraryItem } from "./look/Look.libraryItem";

/** Timeline items and tracks whose target is the group. */
export function groupUses(groupId: string): number {
    const timeline = useTimeline();
    const items = timeline.items.filter((i) => i.target?.kind === "group" && i.target.id === groupId).length;
    const tracks = timeline.tracks.filter((t) => t.defaultTarget?.kind === "group" && t.defaultTarget.id === groupId).length;
    return items + tracks;
}

/** Looks that reference the preset. */
export function lookUsesOfPreset(presetId: string): LookLibraryItem[] {
    const library = useLibrary();
    return library.items.filter(
        (item): item is LookLibraryItem => isLookLibraryItem(item) && Object.values(item.state.values).some((v) => v?.kind === "preset" && v.presetId === presetId)
    );
}

/** Looks and position presets that aim at one of the targets. */
export function aimTargetUses(targetIds: readonly string[]): { looks: number; presets: number } {
    const library = useLibrary();
    const ids = new Set(targetIds);
    let looks = 0;
    let presets = 0;
    for (const item of library.items) {
        if (isLookLibraryItem(item)) {
            const pan = item.state.values.pan;
            if (pan?.kind === "aim" && ids.has(pan.aimTargetId)) {
                looks++;
            }
        } else if (isPresetLibraryItem(item) && item.state.aimTargetId && ids.has(item.state.aimTargetId)) {
            presets++;
        }
    }
    return { looks, presets };
}
