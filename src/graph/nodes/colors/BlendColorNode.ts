import { Node } from "@baklavajs/core";
import { Color, blend } from "../../colors";

export class BlendColorNode extends Node {
    public type = "Blend Color";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("Color 1", undefined, () => [[0, 0, 0]], { type: "color_array" });
        this.addInputInterface("Color 2", undefined, () => [[0, 0, 0]], { type: "color_array" });
        this.addOption("Mode", "SelectOption", "Multiply", undefined, {
            items: ["Multiply", "Darken", "Lighten", "Screen", "Overlay", "Burn", "Dodge"],
        });
        this.addOutputInterface("Output", { type: "color_array" });
    }

    public calculate() {
        const colorsA: Color[] = this.getInterface("Color 1").value;
        const colorsB: Color[] = this.getInterface("Color 2").value;
        const mode = this.getOptionValue("Mode").toLowerCase();

        const length = Math.max(colorsA.length, colorsB.length);
        const result: Color[] = new Array(length);

        for (let i = 0; i < length; i++) {
            const a = i < colorsA.length ? colorsA[i] : colorsA[colorsA.length - 1];
            const b = i < colorsB.length ? colorsB[i] : colorsB[colorsB.length - 1];
            result[i] = blend(a, b, mode);
        }

        this.getInterface("Output").value = result;
    }
}
