import { ColorSingleInterface, IntegerInterface } from "@/graph/interfaces";
import { defineNode } from "baklavajs";

export const ColorToRgbNode = defineNode({
    type: "ColorToRgb",
    inputs: {
        color: () => new ColorSingleInterface("Color", [0, 0, 0]),
    },
    outputs: {
        r: () => new IntegerInterface("Red", 0, 0, 255).setComponent(undefined),
        g: () => new IntegerInterface("Green", 0, 0, 255).setComponent(undefined),
        b: () => new IntegerInterface("Blue", 0, 0, 255).setComponent(undefined),
    },
    calculate: ({ color }) => {
        return { r: color[0], g: color[1], b: color[2] };
    },
});
