import { LibraryItem, LibraryItemType } from "@/library";
import { BaklavaEvent } from "@baklavajs/events";
import { INote } from "./types";

export interface PatternLibraryItemState {
    notes: INote[];
}

export class PatternLibraryItem extends LibraryItem<PatternLibraryItemState> {
    public type = LibraryItemType.PATTERN;
    public name = "Note Pattern";

    public notes: INote[] = [];

    public events = {
        notesUpdated: new BaklavaEvent<void, this>(this),
    };

    public override save() {
        return {
            notes: this.notes,
        };
    }

    public override load(state: PatternLibraryItemState) {
        this.notes = state.notes;
    }

    public getNotesAt(tick: number) {
        const activeNotes = this.notes.filter((n) => n.start <= tick && n.end >= tick);
        // sort so that the last activated note is at the beginning of the array
        activeNotes.sort((a, b) => b.start - a.start);
        return activeNotes;
    }
}
