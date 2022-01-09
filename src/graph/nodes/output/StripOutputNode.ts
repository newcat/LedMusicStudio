import { OutputType } from "@/output";
import { BaseOutputNode } from "./BaseOutputNode";

export class StripOutputNode extends BaseOutputNode {
    public type = "Strip Output";
    public name = this.type;

    public constructor() {
        super([OutputType.DUMMY, OutputType.WLED, OutputType.RAZER_CHROMA]);
        this.addInputInterface("Colors", undefined, [[0, 0, 0]], { type: "color_array" });
        this.addOption("Preview", "PreviewOption", [[0, 0, 0]]);
    }

    public calculate() {
        const colors = this.getInterface("Colors").value;
        this.setOptionValue("Preview", colors);
        return this.afterCalculate({ colors });
    }
}
