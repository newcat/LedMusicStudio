import type chroma from "chroma-js";
import { defineNode, SelectInterface } from "baklavajs";
import { ColorArrayInterface, SliderInterface } from "@/graph/interfaces";
import { Color, mix } from "../../colors";

export const MixColorNode = defineNode({
    type: "Mix Color",
    inputs: {
        color1: () => new ColorArrayInterface("Color 1"),
        color2: () => new ColorArrayInterface("Color 2"),
        factor: () => new SliderInterface("Factor", 0.5, 0, 1),
        colorSpace: () => new SelectInterface("Color Space", "RGB", ["RGB", "HSL", "LAB", "LCH", "LRGB"]),
    },
    outputs: {
        output: () => new ColorArrayInterface("Output"),
    },
    calculate({ color1, color2, factor, colorSpace }) {
        const length = Math.max(color1.length, color2.length);
        const result: Color[] = new Array(length);

        for (let i = 0; i < length; i++) {
            const a = i < color1.length ? color1[i] : color1[color1.length - 1];
            const b = i < color2.length ? color2[i] : color2[color2.length - 1];
            result[i] = mix(a, b, factor, colorSpace.toLowerCase() as chroma.InterpolationMode);
        }

        return { output: result };
    },
});
