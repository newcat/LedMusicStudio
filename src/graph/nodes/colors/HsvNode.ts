import { Node } from "@baklavajs/core";
import { fromChroma, chroma } from "../../colors";

export class HsvNode extends Node {
    public type = "HSV";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("Hue", "SliderOption", 0, { type: "number", min: 0, max: 360 });
        this.addInputInterface("Saturation", "SliderOption", 0, { type: "number", min: 0, max: 1 });
        this.addInputInterface("Value", "SliderOption", 0, { type: "number", min: 0, max: 1 });
        this.addOption("Preview", "PreviewOption", [[0, 0, 0]]);
        this.addOutputInterface("Color", { type: "color_single" });
    }

    public calculate() {
        const h = this.getInterface("Hue").value;
        const s = this.getInterface("Saturation").value;
        const v = this.getInterface("Value").value;
        const c = fromChroma(chroma(h, s, v, "hsv"));
        this.setOptionValue("Preview", [c]);
        this.getInterface("Color").value = c;
    }
}
