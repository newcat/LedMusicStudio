import { defineDynamicNode } from "baklavajs";
import { ColorArrayInterface, IntegerInterface } from "../../interfaces";
import { LmsCalculationContext } from "../../types";
import { Color } from "../../colors";
import { scaleColorArray } from "@/utils";

export const SplitNode = defineDynamicNode({
    type: "Split",
    inputs: {
        splitInto: () => new IntegerInterface("Split Into", 2, 1, 10),
        colors: () => new ColorArrayInterface("Colors", []),
    },
    onUpdate: ({ splitInto }) => {
        const outputs: Record<string, () => ColorArrayInterface> = {};
        for (let i = 1; i <= splitInto; i++) {
            outputs[`output${i}`] = () => new ColorArrayInterface(`Output ${i}`, []);
        }

        return { outputs };
    },
    calculate: ({ colors, splitInto }, ctx: LmsCalculationContext) => {
        const result: Record<string, Color[]> = {};
        for (let i = 1; i <= splitInto; i++) {
            // slice the input array into splitInto parts
            const output = colors.slice((i - 1) * (colors.length / splitInto), i * (colors.length / splitInto));
            result[`output${i}`] = scaleColorArray(output, ctx.globalValues.resolution);
        }
        return result;
    },
});
