/**
 * Preset library item (feature 004, US7, data-model §8): position, color or beam values (common and per fixture)
 * that looks reference by id. The kind is fixed after creation.
 */

import { LibraryItem, LibraryItemType } from "@/library/libraryItem";
import { defaultPresetState, PRESET_KIND_LABELS, sanitizePresetState, type PresetKind, type PresetState } from "../states";

export class PresetLibraryItem extends LibraryItem<PresetState> {
    public type = LibraryItemType.PRESET;
    public name: string;

    public state: PresetState;

    public constructor(kind: PresetKind = "position") {
        super();
        this.state = defaultPresetState(kind);
        this.name = `${PRESET_KIND_LABELS[kind]} preset`;
    }

    public save(): PresetState {
        return JSON.parse(JSON.stringify(this.state)) as PresetState;
    }

    public load(state: PresetState): void {
        this.state = sanitizePresetState(state);
    }
}
