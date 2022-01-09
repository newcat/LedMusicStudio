import { serialize, deserialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";
import { BaklavaEditor } from "./editor";

export class GraphLibraryItem extends LibraryItem {
    public type = LibraryItemType.GRAPH;
    public name = "Graph";

    public editor = new BaklavaEditor();

    public serialize() {
        return serialize({
            id: this.id,
            name: this.name,
            state: this.editor.save(),
        });
    }

    public deserialize(buffer: Buffer): void {
        const { id, name, state } = deserialize(buffer);
        this.id = id;
        this.name = name;
        this.editor.load(state);
    }
}
