import { NumberInterface } from "@/graph/interfaces";
import { defineNode } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";

const operations = [
    "Add",
    "Subtract",
    "Multiply",
    "Divide",
    "Sine",
    "Cosine",
    "Tangent",
    "Arcsine",
    "Arccosine",
    "Arctangent",
    "Power",
    "Logarithm",
    "Minimum",
    "Maximum",
    "Round",
    "Modulo",
    "Absolute",
];

export const MathNode = defineNode({
    type: "Math",
    inputs: {
        val1: () => new NumberInterface("Value 1", 0),
        val2: () => new NumberInterface("Value 2", 0),
        operation: () => new SelectInterface("Operation", "Add", operations),
    },
    outputs: {
        result: () => new NumberInterface("Result", 0),
    },
    calculate({ val1, val2, operation }) {
        let outputVal = 0;
        switch (operation) {
            case "Add":
                outputVal = val1 + val2;
                break;
            case "Subtract":
                outputVal = val1 - val2;
                break;
            case "Multiply":
                outputVal = val1 * val2;
                break;
            case "Divide":
                outputVal = val2 !== 0 ? val1 / val2 : 0;
                break;
            case "Sine":
                outputVal = Math.sin(val1);
                break;
            case "Cosine":
                outputVal = Math.cos(val1);
                break;
            case "Tangent":
                outputVal = Math.tan(val1);
                break;
            case "Arcsine":
                outputVal = Math.asin(val1);
                break;
            case "Arccosine":
                outputVal = Math.acos(val1);
                break;
            case "Arctangent":
                outputVal = Math.atan(val1);
                break;
            case "Power":
                outputVal = Math.pow(val1, val2);
                break;
            case "Logarithm":
                outputVal = Math.log(val1) / Math.log(val2);
                break;
            case "Minimum":
                outputVal = Math.min(val1, val2);
                break;
            case "Maximum":
                outputVal = Math.max(val1, val2);
                break;
            case "Round":
                outputVal = Math.round(val1);
                break;
            case "Modulo":
                outputVal = val1 % val2;
                break;
            case "Absolute":
                outputVal = Math.abs(val1);
                break;
        }

        return { result: outputVal };
    },
});
