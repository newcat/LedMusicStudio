import { serialize, deserialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";
import { BaklavaEditor } from "./editor";
import { KeyframeManager } from "./keyframes/KeyframeManager";

export class GraphLibraryItem extends LibraryItem {
    public type = LibraryItemType.GRAPH;
    public name = "Graph";

    public editor = new BaklavaEditor();
    public keyframeManager = new KeyframeManager(this);

    public serialize() {
        return serialize({
            id: this.id,
            name: this.name,
            state: this.editor.editor.save(),
            keyframes: Object.fromEntries(this.keyframeManager.keyframes),
        });
    }

    public deserialize(buffer: Buffer): void {
        const { id, name, state, keyframes } = deserialize(buffer);
        this.id = id;
        this.name = name;
        this.editor.editor.load(state);
        this.keyframeManager.keyframes = new Map(Object.entries(keyframes));
    }
}
