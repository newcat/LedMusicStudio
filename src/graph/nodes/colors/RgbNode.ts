import { defineNode } from "baklavajs";
import { ColorSingleInterface, PreviewInterface, SliderInterface } from "@/graph/interfaces";
import { fromChroma, chroma } from "../../colors";

export const RgbNode = defineNode({
    type: "RGB",
    inputs: {
        r: () => new SliderInterface("R", 0, 0, 1),
        g: () => new SliderInterface("G", 0, 0, 1),
        b: () => new SliderInterface("B", 0, 0, 1),
    },
    outputs: {
        preview: () => new PreviewInterface("Preview"),
        color: () => new ColorSingleInterface("Color").setComponent(undefined),
    },
    calculate({ r, g, b }) {
        const c = fromChroma(chroma(r * 255, g * 255, b * 255, "rgb"));
        return {
            preview: [c],
            color: c,
        };
    },
});
