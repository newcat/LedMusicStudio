import { Color } from "@/graph/colors";
import { scaleColorArray } from "@/utils";
import { Node } from "@baklavajs/core";

export class PreviewNode extends Node {
    public type = "Preview";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("Colors", undefined, [[0, 0, 0]], { type: "color_array" });
        this.addOption("Preview", "PreviewOption", [[0, 0, 0]]);
        this.addOption("Led Count", "NumberOption", 30, undefined, { min: 1 });
    }

    public calculate() {
        const input = this.getInterface("Colors").value as Color[];
        const ledCount = this.getOptionValue("Led Count") as number;
        const scaled = scaleColorArray(input, ledCount);

        this.setOptionValue("Preview", scaled);
        // return input;
        /*globalProcessor.globalPreview = input;
        globalProcessor.events.globalPreviewUpdated.emit();*/
    }
}
