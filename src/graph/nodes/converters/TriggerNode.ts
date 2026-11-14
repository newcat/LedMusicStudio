import { CalculateFunction, Node, NodeInterface } from "baklavajs";
import { CheckboxInterface } from "@/graph/interfaces";
import { LmsCalculationContext } from "@/graph/types";
import { perFixtureState } from "../perFixtureState";

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

    constructor() {
        super();
        this.title = this.type;
        this.initializeIo();
    }

    public override calculate: CalculateFunction<Inputs, Outputs, LmsCalculationContext> = (inputs, context) => {
        const { input } = inputs;
        // last value per fixture of a per-fixture run (feature 004)
        const state = perFixtureState(this, context, () => ({ lastValue: 0 as unknown }));

        let trigger = false;
        if (state.lastValue !== input) {
            trigger = true;
            state.lastValue = input;
        }

        return { trigger };
    };
}
