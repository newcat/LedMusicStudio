import { defineNode } from "@baklavajs/core";
import { ColorArrayInterface } from "@/graph/interfaces";
import { Color, blend } from "../../colors";
import { SelectInterface } from "@baklavajs/renderer-vue";

const BLEND_MODES = ["Multiply", "Darken", "Lighten", "Screen", "Overlay", "Burn", "Dodge"] as const;
type BlendModeTuple = typeof BLEND_MODES;
type BlendMode = BlendModeTuple[number];

export const BlendColorNode = defineNode({
    type: "Blend Color",
    inputs: {
        color1: () => new ColorArrayInterface("Color 1"),
        color2: () => new ColorArrayInterface("Color 2"),
        mode: () => new SelectInterface<BlendMode>("Mode", "Multiply", [...BLEND_MODES]).setPort(false),
    },
    outputs: {
        output: () => new ColorArrayInterface("Output"),
    },
    calculate({ color1, color2, mode }) {
        const length = Math.max(color1.length, color2.length);
        const result: Color[] = new Array(length);

        for (let i = 0; i < length; i++) {
            const a = i < color1.length ? color1[i] : color1[color1.length - 1];
            const b = i < color2.length ? color2[i] : color2[color2.length - 1];
            result[i] = blend(a, b, mode.toLowerCase() as any);
        }

        return { output: result };
    },
});
