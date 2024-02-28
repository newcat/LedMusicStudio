import { defineNode } from "baklavajs";
import { scaleColorArray } from "@/utils";
import { ColorArrayInterface, NumberInterface } from "../../interfaces";
import { LmsCalculationContext } from "../../types";
import { Color } from "../../colors";

export const RotateNode = defineNode({
    type: "Rotate",
    inputs: {
        colorsIn: () => new ColorArrayInterface("Colors", []),
        rotation: () => new NumberInterface("Rotation", 0, 0, 1),
    },
    outputs: {
        colorsOut: () => new ColorArrayInterface("Colors", []),
    },
    calculate: ({ colorsIn, rotation }, ctx: LmsCalculationContext) => {
        const scaledColors = scaleColorArray(colorsIn, ctx.globalValues.resolution);
        const absoluteRotation = Math.round(rotation * ctx.globalValues.resolution);
        const colorsOut: Color[] = [];
        for (let i = 0; i < ctx.globalValues.resolution; i++) {
            colorsOut.push(scaledColors.at(i - absoluteRotation)!);
        }
        return { colorsOut };
    },
});
