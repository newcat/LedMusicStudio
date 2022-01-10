import { BaklavaInterfaceTypes } from "@baklavajs/interface-types";
import { DependencyEngine } from "@baklavajs/engine";
import { useBaklava } from "@baklavajs/renderer-vue";

import { registerNodes } from "./nodes/registerNodes";
import { registerTypes } from "./interface-types";

export class BaklavaEditor {
    public viewModel = useBaklava();
    public enginePlugin = new DependencyEngine(this.editor);
    public intfTypes = new BaklavaInterfaceTypes(this.editor, { engine: this.enginePlugin, viewPlugin: this.viewModel });

    public get editor() {
        return this.viewModel.editor;
    }

    public constructor() {
        registerNodes(this.editor);
        registerTypes(this.intfTypes);

        this.editor.graphEvents.addConnection.subscribe(this, () => this.updateNodeInterfaceTypes());
        this.editor.graphEvents.removeConnection.subscribe(this, () => this.updateNodeInterfaceTypes());
    }

    private updateNodeInterfaceTypes() {
        // TODO: This needs to be done in all graphs
        this.editor.graph.nodes.forEach((n) => {
            if ((n as any).updateNodeInterfaceTypes) {
                (n as any).updateNodeInterfaceTypes(this);
            }
        });
    }
}
