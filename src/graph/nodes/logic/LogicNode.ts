import { CheckboxInterface } from "@/graph/interfaces";
import { defineNode } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";

const operations = ["AND", "OR", "XOR", "NAND", "NOR", "XNOR"];

export const LogicNode = defineNode({
    type: "Logic",
    inputs: {
        a: () => new CheckboxInterface("A", true),
        b: () => new CheckboxInterface("B", true),
        gate: () => new SelectInterface("Gate", "AND", operations),
    },
    outputs: {
        result: () => new CheckboxInterface("Result", false),
    },
    calculate({ a, b, gate }) {
        let output = false;
        switch (gate) {
            case "AND":
                output = a && b;
                break;
            case "OR":
                output = a || b;
                break;
            case "XOR":
                output = a ? !b : b;
                break;
            case "NAND":
                output = !(a && b);
                break;
            case "NOR":
                output = !(a || b);
                break;
            case "XNOR":
                output = a ? b : !b;
                break;
        }
        return { result: output };
    },
});
