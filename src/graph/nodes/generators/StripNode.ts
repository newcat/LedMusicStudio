import { Node } from "@baklavajs/core";
import { Color } from "../../colors";
import { ICalculationData } from "../../types";

export class StripNode extends Node {
    public type = "Strip";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("Start", "SliderOption", 0, { type: "number", min: 0, max: 1 });
        this.addInputInterface("End", "SliderOption", 1, { type: "number", min: 0, max: 1 });
        this.addInputInterface("Color", "ColorOption", [173, 216, 230], { type: "color_single" });
        this.addOutputInterface("Output", { type: "color_array" });
    }

    public calculate(data: ICalculationData) {
        const { resolution } = data;

        const start = this.getInterface("Start").value;
        const end = this.getInterface("End").value;
        const color: Color = this.getInterface("Color").value;

        const result: Color[] = new Array(resolution);

        for (let i = 0; i < resolution; i++) {
            const position = i / resolution;
            result[i] = start <= position && end >= position ? color : [0, 0, 0];
        }

        this.getInterface("Output").value = result;
    }
}
