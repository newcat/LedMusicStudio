import { BaklavaInterfaceTypes } from "@baklavajs/interface-types";
import { applyResult, DependencyEngine } from "@baklavajs/engine";
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

        this.viewModel.settings.enableMinimap = true;
        this.viewModel.settings.nodes.resizable = true;

        this.editor.graphEvents.addConnection.subscribe(this, () => this.updateNodeInterfaceTypes());
        this.editor.graphEvents.removeConnection.subscribe(this, () => this.updateNodeInterfaceTypes());

        this.enginePlugin.events.afterRun.subscribe(this, (r) => {
            applyResult(r, this.editor);
        });
    }

    private updateNodeInterfaceTypes() {
        // TODO: This needs to be done in all graphs
        this.editor.graph.nodes.forEach((n) => {
            if ("updateNodeInterfaceTypes" in n && typeof n.updateNodeInterfaceTypes === "function") {
                n.updateNodeInterfaceTypes(this);
            }
        });
    }
}
