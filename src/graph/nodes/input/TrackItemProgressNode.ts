import { defineNode } from "baklavajs";
import { NumberInterface } from "../../interfaces";
import { LmsCalculationContext } from "../../types";

export const TrackItemProgressNode = defineNode({
    type: "Track Item Progress",
    inputs: {
        min: () => new NumberInterface("Min", 0),
        max: () => new NumberInterface("Max", 1),
    },
    outputs: {
        value: () => new NumberInterface("Value", 0).setComponent(undefined),
    },
    calculate(inputs, context: LmsCalculationContext) {
        const { min, max } = inputs;
        const value = min + (max - min) * context.globalValues.relativeTrackItemProgress;
        return { value };
    },
});
