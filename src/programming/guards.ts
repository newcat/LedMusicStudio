/** Type guards for the library items of feature 004 (type-only imports: no runtime cycle with the library). */

import { LibraryItemType, type LibraryItem } from "@/library/libraryItem";
import type { LookLibraryItem } from "./look/Look.libraryItem";
import type { EffectLibraryItem } from "./effect/Effect.libraryItem";
import type { PresetLibraryItem } from "./preset/Preset.libraryItem";

export function isLookLibraryItem(item: LibraryItem | undefined | null): item is LookLibraryItem {
    return item?.type === LibraryItemType.LOOK;
}

export function isEffectLibraryItem(item: LibraryItem | undefined | null): item is EffectLibraryItem {
    return item?.type === LibraryItemType.EFFECT;
}

export function isPresetLibraryItem(item: LibraryItem | undefined | null): item is PresetLibraryItem {
    return item?.type === LibraryItemType.PRESET;
}

/** Items that have a target and fade handles on the timeline. */
export function isProgrammingClip(item: LibraryItem | undefined | null): item is LookLibraryItem | EffectLibraryItem {
    return isLookLibraryItem(item) || isEffectLibraryItem(item);
}
