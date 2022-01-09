import { Node } from "@baklavajs/core";
import { Color, mix, blend } from "../../colors";

export class MirrorNode extends Node {
    public type = "Mirror";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("Input", undefined, [[0, 0, 0]], { type: "color_array" });
        this.addInputInterface("Strength", "SliderOption", 1, { type: "number", min: 0, max: 1 });
        this.addOutputInterface("Output", { type: "color_array" });
    }

    public calculate() {
        const input: Color[] = this.getInterface("Input").value;
        const strength: number = this.getInterface("Strength").value;

        const resolution = input.length;
        const reverseColors: Color[] = new Array(resolution);
        const result: Color[] = new Array(resolution);
        for (let i = 0; i < resolution; i++) {
            reverseColors[resolution - i - 1] = mix([0, 0, 0], input[i], strength);
        }
        for (let i = 0; i < resolution; i++) {
            result[i] = blend(input[i], reverseColors[i], "lighten");
        }

        this.getInterface("Output").value = result;
    }
}
