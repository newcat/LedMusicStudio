import { markRaw } from "vue";
import { NodeInterface, Node, NodeInterfaceDefinition, INodeState } from "baklavajs";
import { ScriptNodeConfigurationInterface } from "../interfaces";
import { OpenSidebarOption } from "../options";

interface ScriptNodeInputs extends Record<string, any> {
    openSidebar: void;
    config: void;
}

interface ScriptNodeInterface {
    key: string;
    id: string;
    name: string;
    type: string;
}

interface ScriptNodeState extends INodeState<ScriptNodeInputs, Record<string, any>> {
    code: string;
    functionState: Record<string, any>;
    scriptInputs: ScriptNodeInterface[];
    scriptOutputs: ScriptNodeInterface[];
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

    public functionState: Record<string, any> = {};

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

    public override save() {
        const state: ScriptNodeState = {
            ...super.save(),
            code: this.code,
            functionState: this.functionState,
            scriptInputs: Object.entries(this.inputs)
                .filter(([k]) => k !== "openSidebar" && k !== "config")
                .map(([key, input]) => ({
                    key,
                    id: input.id,
                    name: input.name,
                    type: (input as any).type,
                })),
            scriptOutputs: Object.entries(this.outputs).map(([key, input]) => ({
                key,
                id: input.id,
                name: input.name,
                type: (input as any).type,
            })),
        };
        return state;
    }

    public override load(state: ScriptNodeState) {
        super.load(state);
        this.code = state.code;
        this.functionState = state.functionState;
        for (const input of state.scriptInputs) {
            const intf = new NodeInterface<any>(input.name, undefined);
            intf.id = input.id;
            (intf as any).type = input.type;
            this.addInput(input.key, intf);
        }
        for (const output of state.scriptOutputs) {
            const intf = new NodeInterface<any>(output.name, undefined);
            intf.id = output.id;
            (intf as any).type = output.type;
            this.addOutput(output.key, intf);
        }
    }

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
