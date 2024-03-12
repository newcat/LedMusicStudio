import { IEditorState } from "baklavajs";
import { LibraryItem, LibraryItemType } from "@/library";
import { BaklavaEditor } from "./editor";
import { KeyframeManager, InterfaceKeyframes } from "./keyframes/KeyframeManager";
import { useGlobalState } from "@/globalState";

export interface GraphLibraryItemState {
    graph: IEditorState;
    keyframes: Record<string, InterfaceKeyframes>;
}

export class GraphLibraryItem extends LibraryItem<GraphLibraryItemState> {
    public type = LibraryItemType.GRAPH;
    public name = "Graph";

    public editor = new BaklavaEditor();
    public keyframeManager = new KeyframeManager(this);

    public constructor() {
        super();
        useGlobalState().graphTemplates.registerTarget(this.editor.editor);
    }

    public override save() {
        return {
            graph: this.editor.editor.save(),
            keyframes: Object.fromEntries(this.keyframeManager.keyframes),
        };
    }

    public override load(state: GraphLibraryItemState) {
        const warnings = this.editor.editor.load(state.graph);
        if (warnings.length > 0) {
            console.warn("Warnings while loading graph:", warnings);
        }
        this.keyframeManager.keyframes = new Map(Object.entries(state.keyframes));
    }

    public override destroy(): Promise<void> {
        useGlobalState().graphTemplates.unregisterTarget(this.editor.editor);
        return Promise.resolve();
    }
}
