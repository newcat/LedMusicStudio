/**
 * Look library item (feature 004, US6, data-model §6): static attribute values (single, fan, preset or aim) for the
 * fixtures of the timeline item's target, with fades and fan timing.
 */

import { LibraryItem, LibraryItemType } from "@/library/libraryItem";
import { defaultLookState, sanitizeLookState, type LookState } from "../states";

export class LookLibraryItem extends LibraryItem<LookState> {
    public type = LibraryItemType.LOOK;
    public name = "Look";

    public state: LookState = defaultLookState();

    public save(): LookState {
        return JSON.parse(JSON.stringify(this.state)) as LookState;
    }

    public load(state: LookState): void {
        this.state = sanitizeLookState(state);
    }
}
