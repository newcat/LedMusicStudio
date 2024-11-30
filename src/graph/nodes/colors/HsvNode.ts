import { defineNode } from "baklavajs";
import { ColorSingleInterface, PreviewInterface, SliderInterface } from "@/graph/interfaces";
import { fromChroma, chroma } from "../../colors";

export const HsvNode = defineNode({
    type: "HSV",
    inputs: {
        hue: () => new SliderInterface("Hue", 0, 0, 360),
        saturation: () => new SliderInterface("Saturation", 0, 0, 1),
        value: () => new SliderInterface("Value", 0, 0, 1),
    },
    outputs: {
        preview: () => new PreviewInterface("Preview"),
        color: () => new ColorSingleInterface("Color").setComponent(undefined),
    },
    calculate({ hue, saturation, value }) {
        const c = fromChroma(chroma(hue, saturation, value, "hsv"));
        return {
            preview: [c],
            color: c,
        };
    },
});
