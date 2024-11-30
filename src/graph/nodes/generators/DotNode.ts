import { defineNode, SelectInterface } from "baklavajs";
import { ColorArrayInterface, ColorSingleInterface, NumberInterface, SliderInterface } from "@/graph/interfaces";
import { Color, toChroma, fromChroma } from "../../colors";
import { LmsCalculationContext } from "../../types";

function clamp(v: number, min: number, max: number) {
    if (!Number.isFinite(v)) {
        return 0;
    }
    return Math.min(max, Math.max(min, v));
}

function linearIntensity(center: number, position: number, width: number): number {
    if (width === 0) {
        return 0;
    }
    const distance = Math.abs(position - center);
    return 1 - distance / width;
}

function exponentialIntensity(center: number, position: number, pBase: number): number {
    const distance = Math.abs(position - center);
    return Math.pow(pBase, distance);
}

function gaussianIntensity(center: number, position: number, stdDeviation: number): number {
    return (
        Math.exp(-((position - center) * (position - center)) / (2 * stdDeviation * stdDeviation)) / (stdDeviation * Math.sqrt(2 * Math.PI))
    );
}

export const DotNode = defineNode({
    type: "Dot",
    inputs: {
        centerPosition: () => new SliderInterface("Center Position", 0, 0, 1),
        alpha: () => new SliderInterface("Alpha", 1, 0, 1),
        color: () => new ColorSingleInterface("Color", [173, 216, 230]),
        glow: () => new NumberInterface("Glow", 0.1),
        glowType: () => new SelectInterface("Glow Type", "Linear", ["Linear", "Exponential", "Gaussian"]).setPort(false),
    },
    outputs: {
        colors: () => new ColorArrayInterface("Colors"),
    },
    calculate(inputs, context: LmsCalculationContext) {
        const { resolution } = context.globalValues;
        const { color, glowType } = inputs;

        const centerPosition = clamp(inputs.centerPosition, 0, 1);
        const alpha = clamp(inputs.alpha, 0, 1);
        const glow = Math.max(0, inputs.glow);

        const result: Color[] = new Array(resolution);

        let intensity;
        switch (glowType) {
            case "Exponential":
                intensity = exponentialIntensity;
                break;
            case "Gaussian":
                intensity = gaussianIntensity;
                break;
            default:
            case "Linear":
                intensity = linearIntensity;
                break;
        }

        for (let i = 0; i < resolution; i++) {
            const position = i / resolution;
            const luminance = clamp(alpha * intensity(centerPosition, position, glow) * toChroma(color).get("hsi.i"), 0, 1);
            result[i] = fromChroma(toChroma(color).set("hsi.i", luminance));
        }

        return { colors: result };
    },
});
