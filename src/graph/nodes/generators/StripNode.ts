import { ColorArrayInterface, ColorSingleInterface, SliderInterface } from "@/graph/interfaces";
import { defineNode } from "@baklavajs/core";
import { Color } from "../../colors";
import { LmsCalculationContext } from "../../types";

export const StripNode = defineNode({
    type: "Strip",
    inputs: {
        start: () => new SliderInterface("Start", 0.25, 0, 1),
        end: () => new SliderInterface("End", 0.75, 0, 1),
        color: () => new ColorSingleInterface("Color", [173, 216, 230]),
    },
    outputs: {
        output: () => new ColorArrayInterface("Output"),
    },
    calculate({ start, end, color }, context: LmsCalculationContext) {
        const { resolution } = context.globalValues;
        const result: Color[] = new Array(resolution);
        for (let i = 0; i < resolution; i++) {
            const position = i / resolution;
            result[i] = start <= position && end >= position ? color : [0, 0, 0];
        }
        return { output: result };
    },
});
