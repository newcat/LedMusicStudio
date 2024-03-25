import { defineNode } from "@baklavajs/core";
import { scaleColorArray } from "@/utils";
import { LmsCalculationContext } from "../../types";
import { ColorArrayInterface, IntegerInterface } from "../../interfaces";
import { Color } from "../../colors";

export const RepeatNode = defineNode({
    type: "Repeat",
    inputs: {
        colors: () => new ColorArrayInterface("Input", []),
        amount: () => new IntegerInterface("Amount", 4, 1),
    },
    outputs: {
        colors: () => new ColorArrayInterface("Value", []),
    },
    calculate(inputs, context: LmsCalculationContext) {
        const { colors, amount } = inputs;
        const part = scaleColorArray(colors, Math.floor(context.globalValues.resolution / amount));
        const outputColors: Color[] = [];
        for (let i = 0; i < amount; i++) {
            outputColors.push(...part);
        }
        while (outputColors.length < context.globalValues.resolution) {
            outputColors.push([0, 0, 0]);
        }
        return { colors: outputColors };
    },
});
