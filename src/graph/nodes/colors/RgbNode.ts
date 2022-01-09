import { Node } from "@baklavajs/core";
import { fromChroma, chroma } from "../../colors";

export class RgbNode extends Node {
    public type = "RGB";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("R", "SliderOption", 0, { type: "number", min: 0, max: 1 });
        this.addInputInterface("G", "SliderOption", 0, { type: "number", min: 0, max: 1 });
        this.addInputInterface("B", "SliderOption", 0, { type: "number", min: 0, max: 1 });
        this.addOption("Preview", "PreviewOption", [[0, 0, 0]]);
        this.addOutputInterface("Color", { type: "color_single" });
    }

    public calculate() {
        const r = this.getInterface("R").value * 255;
        const g = this.getInterface("G").value * 255;
        const b = this.getInterface("B").value * 255;
        const c = fromChroma(chroma(r, g, b, "rgb"));
        this.setOptionValue("Preview", [c]);
        this.getInterface("Color").value = c;
    }
}
