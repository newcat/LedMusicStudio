import { BaklavaInterfaceTypes, NodeInterfaceType } from "@baklavajs/interface-types";
import { Color } from "./colors";

export const BooleanType = new NodeInterfaceType<boolean>("boolean");
export const ColorSingleType = new NodeInterfaceType<Color>("color_single");
export const ColorArrayType = new NodeInterfaceType<Color[]>("color_array");
export const NumberType = new NodeInterfaceType<number>("number");
export const PositionsType = new NodeInterfaceType<number[]>("positions");

BooleanType.addConversion(NumberType, (v) => (v ? 1 : 0));
ColorSingleType.addConversion(ColorArrayType, (v) => [v]);
ColorArrayType.addConversion(ColorSingleType, (v) => (v && v.length > 0 ? v[0] : [0, 0, 0]));
NumberType.addConversion(BooleanType, (v) => v !== 0);
NumberType.addConversion(ColorSingleType, (v) => [v * 255, v * 255, v * 255]);
NumberType.addConversion(ColorArrayType, (v) => [[v * 255, v * 255, v * 255]]);

export function registerTypes(intfTypes: BaklavaInterfaceTypes) {
    intfTypes.addTypes(BooleanType, ColorSingleType, ColorArrayType, NumberType, PositionsType);
}
