import { serialize, deserialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";
import { BaklavaEvent } from "@baklavajs/events";
import { INote } from "./types";

export class PatternLibraryItem extends LibraryItem {
    public type = LibraryItemType.PATTERN;
    public name = "Note Pattern";

    public notes: INote[] = [];

    public events = {
        notesUpdated: new BaklavaEvent<void, this>(this),
    };

    public serialize() {
        return serialize({
            id: this.id,
            name: this.name,
            notes: this.notes,
        });
    }

    public deserialize(buffer: Buffer): void {
        const { id, name, notes } = deserialize(buffer);
        this.id = id;
        this.name = name;
        this.notes = notes;
    }

    public getNotesAt(tick: number) {
        const activeNotes = this.notes.filter((n) => n.start <= tick && n.end >= tick);
        // sort so that the last activated note is at the beginning of the array
        activeNotes.sort((a, b) => b.start - a.start);
        return activeNotes;
    }
}
