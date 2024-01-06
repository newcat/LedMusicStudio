import { markRaw } from "vue";
import { NodeInterface, Node, NodeInterfaceDefinition } from "baklavajs";
import { ScriptNodeConfigurationInterface } from "../interfaces";
import { OpenSidebarOption } from "../options";

interface ScriptNodeInputs extends Record<string, any> {
    openSidebar: void;
    config: void;
}

export interface ScriptNodeInterface {
    id: string;
    name: string;
    type: string;
}

export default class ScriptNode extends Node<ScriptNodeInputs, Record<string, any>> {
    public override readonly type = "Script";
    public override inputs: NodeInterfaceDefinition<ScriptNodeInputs> = {
        openSidebar: new NodeInterface<void>("Configure", undefined).setComponent(markRaw(OpenSidebarOption)).setPort(false),
        config: new ScriptNodeConfigurationInterface(this).setHidden(true),
    };
    public override outputs: NodeInterfaceDefinition<Record<string, any>> = {};

    public code = "return {\n  output: this.input\n};";
    public codeChangedSinceLastCalculate = false;
    // eslint-disable-next-line @typescript-eslint/ban-types
    public calcFunction: Function | undefined;

    public functionState = {};

    public constructor() {
        super();
        this._title = "Script";
    }

    public override calculate = (inputs: Record<string, any>) => {
        if (this.calcFunction === undefined || this.codeChangedSinceLastCalculate) {
            this.calcFunction = new Function(this.code);
            this.codeChangedSinceLastCalculate = false;
        }

        // map inputs (object id -> value) to their names (creating an object name -> value)
        const inputValues = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [this.inputs[key].name, value]));

        const outputValues = this.calcFunction.call({ inputs: inputValues, state: this.functionState });

        // map outputs back to their ids
        const outputs: Record<string, any> = {};
        for (const [key, value] of Object.entries(outputValues)) {
            const [k] = Object.entries(this.outputs).find(([_k, v]) => v.name === key)!;
            outputs[k] = value;
        }

        return outputs;
    };

    public addScriptInput(name: string) {
        const input = new NodeInterface<any>(name, undefined);
        this.addInput(input.id, input);
    }

    public addScriptOutput(name: string) {
        const output = new NodeInterface<any>(name, undefined);
        this.addOutput(output.id, output);
    }

    public removeScriptInput(key: string) {
        this.removeInput(key);
    }

    public removeScriptOutput(key: string) {
        this.removeOutput(key);
    }
}
