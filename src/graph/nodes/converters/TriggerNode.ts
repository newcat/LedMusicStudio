import { CalculateFunction, Node, NodeInterface } from "baklavajs";
import { CheckboxInterface } from "@/graph/interfaces";
import { LmsCalculationContext } from "@/graph/types";

interface Inputs {
    input: any;
}

interface Outputs {
    trigger: boolean;
}

export class TriggerNode extends Node<Inputs, Outputs> {
    public type = "Trigger";

    public inputs = {
        input: new NodeInterface("Input", false),
    };

    public outputs = {
        trigger: new CheckboxInterface("Trigger", false).setComponent(undefined),
    };

    private lastValue = 0;

    constructor() {
        super();
        this.title = this.type;
        this.initializeIo();
    }

    public override calculate: CalculateFunction<Inputs, Outputs, LmsCalculationContext> = (inputs) => {
        const { input } = inputs;

        let trigger = false;
        if (this.lastValue !== input) {
            trigger = true;
            this.lastValue = input;
        }

        return { trigger };
    };
}
