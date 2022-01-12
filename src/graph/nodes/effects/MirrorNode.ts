import { ColorArrayInterface, SliderInterface } from "@/graph/interfaces";
import { defineNode } from "@baklavajs/core";
import { Color, mix, blend } from "../../colors";

export const MirrorNode = defineNode({
    type: "Mirror",
    inputs: {
        input: () => new ColorArrayInterface("Input"),
        strength: () => new SliderInterface("Strength", 1, 0, 1),
    },
    outputs: {
        output: () => new ColorArrayInterface("Output"),
    },
    calculate({ input, strength }) {
        const resolution = input.length;
        const reverseColors: Color[] = new Array(resolution);
        const result: Color[] = new Array(resolution);
        for (let i = 0; i < resolution; i++) {
            reverseColors[resolution - i - 1] = mix([0, 0, 0], input[i], strength);
        }
        for (let i = 0; i < resolution; i++) {
            result[i] = blend(input[i], reverseColors[i], "lighten");
        }

        return { output: result };
    },
});
