import { defineNode, NodeInterface } from "baklavajs";
import { CheckboxInterface } from "@/graph/interfaces";

export const IfNode = defineNode({
    type: "If",
    inputs: {
        condition: () => new CheckboxInterface("Condition", false),
        trueValue: () => new NodeInterface<any>("True Value", undefined),
        falseValue: () => new NodeInterface<any>("False Value", undefined),
    },
    outputs: {
        output: () => new NodeInterface<any>("Output", undefined),
    },
    calculate({ condition, trueValue, falseValue }) {
        return { output: condition ? trueValue : falseValue };
    },
});
