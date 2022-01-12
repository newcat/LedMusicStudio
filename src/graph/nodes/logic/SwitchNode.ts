/*
TODO: 
import { Node, Editor } from "@baklavajs/core";

export class SwitchNode extends Node {
    public type = "Switch";
    public name = this.type;

    private intfType: string | undefined = undefined;
    private editor?: Editor;

    constructor() {
        super();
        this.addInputInterface("Switch", "IntegerOption", 0, { type: "number" });
        this.addNewInterface();
        this.addNewInterface();
        this.addOption("Add Input", "CustomButtonOption");
        this.addOption("Remove Input", "CustomButtonOption");
        this.addOutputInterface("Output");
        this.hooks.load.tap(this, (state) => {
            // Remove existing interfaces
            for (const i of Object.keys(this.inputInterfaces)) {
                if (i !== "Switch") {
                    this.removeInterface(i);
                }
            }

            Object.entries(state.customInterfaces).forEach(([name, data]) => {
                const d = data as any;
                this.addInputInterface(name, undefined, undefined, { id: d.id });
            });
            return state;
        });
        this.hooks.save.tap(this, (state) => {
            state.customInterfaces = {};
            this.interfaces.forEach((intf, name) => {
                if (intf.isInput && name !== "Switch") {
                    state.customInterfaces[name] = { id: intf.id };
                }
            });
            return state;
        });
    }

    addNewInterface() {
        const numIntf = Object.keys(this.inputInterfaces).length;
        this.addInputInterface(`Value ${numIntf}`, undefined, undefined, { type: this.intfType });
        this.updateNodeInterfaceTypes();
    }

    removeLastInterface() {
        const intfs = Object.keys(this.inputInterfaces);
        if (intfs.length > 2) {
            this.removeInterface(intfs[intfs.length - 1]);
        }
        this.updateNodeInterfaceTypes();
    }

    onButtonClick(optionName: string) {
        if (optionName === "Add Input") {
            this.addNewInterface();
        } else if (optionName === "Remove Input") {
            this.removeLastInterface();
        }
    }

    calculate() {
        const intfs = Object.keys(this.inputInterfaces);
        const val = Math.floor(this.getInterface("Switch").value) + 1;
        let outputVal = null;
        if (val < 1) {
            outputVal = this.getInterface(intfs[1]).value;
        } else if (val >= intfs.length) {
            outputVal = this.getInterface(intfs[intfs.length - 1]).value;
        } else {
            outputVal = this.getInterface(intfs[val]).value;
        }
        this.getInterface("Output").value = outputVal;
    }

    updateNodeInterfaceTypes(editor?: Editor) {
        if (editor && !this.editor) {
            this.editor = editor;
        } else if (!this.editor) {
            return;
        }
        let type: string | undefined = undefined;
        for (const k in this.inputInterfaces) {
            const intf = this.interfaces.get(k)!;
            if (intf.connectionCount > 0) {
                const conn = this.editor.connections.find((c) => c.to === intf);
                if (conn) {
                    type = conn.from.type;
                    break;
                }
            }
        }
        if (!type) {
            type = undefined;
        }
        this.intfType = type;
        this.interfaces.forEach((i) => {
            i.type = type;
            i.events.updated.emit();
        });
    }
}

*/