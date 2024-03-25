import { defineNode } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";
import { TICKS_PER_BEAT } from "@/constants";
import { LmsCalculationContext } from "../../types";
import { ColorArrayInterface } from "../../interfaces";
import { Color } from "../../colors";

const rates = [
    { text: "1/8 Beat", value: TICKS_PER_BEAT / 8 },
    { text: "1/6 Beat", value: TICKS_PER_BEAT / 6 },
    { text: "1/4 Beat", value: TICKS_PER_BEAT / 4 },
    { text: "1/3 Beat", value: TICKS_PER_BEAT / 3 },
    { text: "1/2 Beat", value: TICKS_PER_BEAT / 2 },
    { text: "1 Beat", value: TICKS_PER_BEAT },
    { text: "2 Beats", value: 2 * TICKS_PER_BEAT },
    { text: "4 Beats", value: 4 * TICKS_PER_BEAT },
    { text: "8 Beats", value: 8 * TICKS_PER_BEAT },
];

export const StrobeNode = defineNode({
    type: "Strobe",
    inputs: {
        colors: () => new ColorArrayInterface("Input", []),
        rate: () => new SelectInterface("Rate", TICKS_PER_BEAT / 2, rates).setPort(false),
    },
    outputs: {
        colors: () => new ColorArrayInterface("Value", []),
    },
    calculate(inputs, context: LmsCalculationContext) {
        const { colors, rate } = inputs;
        const x = (context.globalValues.position % rate) / rate;
        const v = Math.sin(Math.PI * 2 * x) >= 0 ? 1 : 0;
        const outputColors = colors.map((color) => color.map((c) => c * v)) as Color[];
        return { colors: outputColors };
    },
});
