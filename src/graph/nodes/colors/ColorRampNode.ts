import { markRaw } from "vue";
import { NodeInterface, defineNode } from "baklavajs";
import { ColorArrayInterface, ColorSingleInterface, SliderInterface } from "../../interfaces";
import { Color } from "../../colors";
import ColorRampOption from "../../options/ColorRampOption.vue";

export interface ColorRampStop {
    id: string;
    position: number;
    color: Color;
}

export interface ColorRampValue {
    mode: "RGB" | "HSV" | "HSL";
    stops: ColorRampStop[];
}

export const ColorRampNode = defineNode({
    type: "Color Ramp",
    inputs: {
        colorRamp: () =>
            new NodeInterface<ColorRampValue>("Color Ramp", { mode: "RGB", stops: [] })
                .setPort(false)
                .setComponent(markRaw(ColorRampOption)),
        factor: () => new SliderInterface("Factor", 0.5, 0, 1),
    },
    outputs: {
        colorRamp: () => new ColorArrayInterface("Color Ramp"),
        value: () => new ColorSingleInterface("Value").setComponent(null),
    },
});
