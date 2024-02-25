import { markRaw } from "vue";
import { NodeInterface, defineNode } from "baklavajs";
import { ColorArrayInterface, ColorSingleInterface, SliderInterface } from "../../interfaces";
import { Color, mix } from "../../colors";
import { LmsCalculationContext } from "../../types";
import ColorRampOption from "../../options/ColorRampOption.vue";

export interface ColorRampStop {
    id: string;
    position: number;
    color: Color;
}

export interface ColorRampValue {
    mode: "rgb" | "hsl";
    stops: ColorRampStop[];
}

export const ColorRampNode = defineNode({
    type: "Color Ramp",
    inputs: {
        colorRamp: () =>
            new NodeInterface<ColorRampValue>("Color Ramp", { mode: "rgb", stops: [] })
                .setPort(false)
                .setComponent(markRaw(ColorRampOption)),
        factor: () => new SliderInterface("Factor", 0.5, 0, 1),
    },
    outputs: {
        colorRamp: () => new ColorArrayInterface("Color Ramp"),
        value: () => new ColorSingleInterface("Value").setComponent(null),
    },
    calculate({ colorRamp, factor }, ctx: LmsCalculationContext) {
        if (colorRamp.stops.length === 0) {
            return {
                colorRamp: [[0, 0, 0]] as Color[],
                value: [0, 0, 0] as Color,
            };
        } else if (colorRamp.stops.length === 1) {
            return {
                colorRamp: [colorRamp.stops[0].color],
                value: colorRamp.stops[0].color,
            };
        }

        const stops = colorRamp.stops.sort((a, b) => a.position - b.position);

        function getColorAtPosition(position: number) {
            const nextStopIndex = stops.findIndex((stop) => stop.position > position);
            if (nextStopIndex === -1) {
                return stops[stops.length - 1].color;
            } else if (nextStopIndex === 0) {
                return stops[0].color;
            }
            const prevStop = stops[nextStopIndex - 1];
            const nextStop = stops[nextStopIndex];
            const f = (position - prevStop.position) / (nextStop.position - prevStop.position);
            return mix(prevStop.color, nextStop.color, f, colorRamp.mode);
        }

        const ramp: Color[] = [];
        for (let i = 0; i < ctx.globalValues.resolution; i++) {
            const position = i / (ctx.globalValues.resolution - 1);
            ramp.push(getColorAtPosition(position));
        }

        return {
            colorRamp: ramp,
            value: getColorAtPosition(Math.max(0, Math.min(1, factor))),
        };
    },
});
