import { IEditorState } from "baklavajs";
import { LibraryItem, LibraryItemType } from "@/library";
import { BaklavaEditor } from "./editor";
import { KeyframeManager, InterfaceKeyframes } from "./keyframes/KeyframeManager";

export interface GraphLibraryItemState {
    graph: IEditorState;
    keyframes: Record<string, InterfaceKeyframes>;
}

export class GraphLibraryItem extends LibraryItem<GraphLibraryItemState> {
    public type = LibraryItemType.GRAPH;
    public name = "Graph";

    public editor = new BaklavaEditor();
    public keyframeManager = new KeyframeManager(this);

    public override save() {
        return {
            graph: this.editor.editor.save(),
            keyframes: Object.fromEntries(this.keyframeManager.keyframes),
        };
    }

    public override load(state: GraphLibraryItemState) {
        this.editor.editor.load(state.graph);
        this.keyframeManager.keyframes = new Map(Object.entries(state.keyframes));
    }
}
