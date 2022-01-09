import { OutputType } from "@/output";
import type { IDmxOutputData } from "@/output/dmx/dmx.output";
import { BaseOutputNode } from "./BaseOutputNode";

export class DmxSpotOutputNode extends BaseOutputNode {
    public type = "DMX Spot Output";
    public name = this.type;

    public constructor() {
        super([OutputType.DMX]);
        this.addInputInterface("Color", undefined, [0, 0, 0], { type: "color_single" });
        this.addInputInterface("Red address", "IntegerOption", 1, { type: "number", min: 1, max: 512 });
        this.addInputInterface("Green address", "IntegerOption", 2, { type: "number", min: 1, max: 512 });
        this.addInputInterface("Blue address", "IntegerOption", 3, { type: "number", min: 1, max: 512 });
        this.addOption("Preview", "PreviewOption", [[0, 0, 0]]);
    }

    public calculate() {
        const color = this.getInterface("Color").value;
        this.setOptionValue("Preview", [color]);

        const redAddress = Math.floor(this.getInterface("Red address").value) ?? -1;
        const greenAddress = Math.floor(this.getInterface("Green address").value) ?? -1;
        const blueAddress = Math.floor(this.getInterface("Blue address").value) ?? -1;

        if (redAddress > 0 && greenAddress > 0 && blueAddress > 0) {
            const channels = new Map<number, number>();
            channels.set(redAddress, color[0]);
            channels.set(greenAddress, color[1]);
            channels.set(blueAddress, color[2]);
            return this.afterCalculate({ channels } as IDmxOutputData);
        }
    }
}
