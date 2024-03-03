import { defineNode } from "@baklavajs/core";
import { TICKS_PER_BEAT } from "@/constants";
import { LmsCalculationContext } from "../../types";
import { CheckboxInterface, NumberInterface, SliderInterface } from "@/graph/interfaces";
import { SelectInterface } from "@baklavajs/renderer-vue";

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

const functions: Record<string, (x: number) => number> = {
    Sine: (x: number) => Math.sin(Math.PI * 2 * x),
    Triangle: (x: number) => 4 * Math.abs(x - Math.floor(x + 0.5)) - 1,
    Sawtooth: (x: number) => 2 * x - 1,
    Square: (x: number) => {
        const v = Math.sign(Math.sin(Math.PI * 2 * x));
        return v === 0 ? -1 : v;
    },
};

export const LfoNode = defineNode({
    type: "LFO",
    inputs: {
        min: () => new NumberInterface("Min", 0),
        max: () => new NumberInterface("Max", 1),
        phaseOffset: () => new SliderInterface("Phase Offset", 0, 0, 1),
        invert: () => new CheckboxInterface("Invert", false),
        rate: () => new SelectInterface("Rate", TICKS_PER_BEAT / 8, rates).setPort(false),
        shape: () => new SelectInterface("Shape", "Sine", Object.keys(functions)).setPort(false),
    },
    outputs: {
        value: () => new NumberInterface("Value", 0).setComponent(undefined),
    },
    calculate(inputs, context: LmsCalculationContext) {
        const { min, max, phaseOffset, invert, rate, shape } = inputs;
        const f = functions[shape] ?? ((v: number) => v);
        const x = (context.globalValues.position % rate) / rate + phaseOffset;
        const rawValue = invert ? -f(x) : f(x);
        const value = min + (rawValue + 1) * 0.5 * (max - min);
        return { value };
    },
});
