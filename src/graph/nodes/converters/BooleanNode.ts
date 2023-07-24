import { CheckboxInterface, NumberInterface } from "@/graph/interfaces";
import { defineNode } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";

const operations = ["==", ">", "<", ">=", "<="];

export const BooleanNode = defineNode({
    type: "Boolean",
    inputs: {
        val1: () => new NumberInterface("Value 1", 0),
        val2: () => new NumberInterface("Value 2", 0),
        useInt: () => new CheckboxInterface("Round Values", false),
        invert: () => new CheckboxInterface("Invert Output", false),
        operation: () => new SelectInterface("Operation", "==", operations),
    },
    outputs: {
        result: () => new CheckboxInterface("Result", false).setComponent(false),
    },
    calculate(inputs) {
        const { val1, val2, useInt, invert, operation } = inputs;

        let result = false;
        switch (operation) {
            case "==":
                result = useInt ? Math.round(val1) === Math.round(val2) : val1 === val2;
                break;
            case ">":
                result = useInt ? Math.round(val1) > Math.round(val2) : val1 > val2;
                break;
            case "<":
                result = useInt ? Math.round(val1) < Math.round(val2) : val1 < val2;
                break;
            case ">=":
                result = useInt ? Math.round(val1) >= Math.round(val2) : val1 >= val2;
                break;
            case "<=":
                result = useInt ? Math.round(val1) <= Math.round(val2) : val1 <= val2;
                break;
        }
        if (invert) {
            result = !result;
        }

        return { result };
    },
});
