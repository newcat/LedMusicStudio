/**
 * Effect library item (feature 004, US5, data-model §7): a beat-synced phaser on one attribute (or pan + tilt),
 * spread over the fixtures of the timeline item's target.
 */

import { LibraryItem, LibraryItemType } from "@/library/libraryItem";
import { defaultEffectState, sanitizeEffectState, type EffectState } from "../states";

export class EffectLibraryItem extends LibraryItem<EffectState> {
    public type = LibraryItemType.EFFECT;
    public name = "Effect";

    public state: EffectState = defaultEffectState();

    public save(): EffectState {
        return JSON.parse(JSON.stringify(this.state)) as EffectState;
    }

    public load(state: EffectState): void {
        this.state = sanitizeEffectState(state);
    }
}
