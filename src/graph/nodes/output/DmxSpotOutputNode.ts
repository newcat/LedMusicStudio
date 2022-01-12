import { Color } from "@/graph/colors";
import { ColorSingleInterface, IntegerInterface, PreviewInterface } from "@/graph/interfaces";
import { OutputType } from "@/output";
import type { IDmxOutputData } from "@/output/dmx/dmx.output";
import { CalculateFunction, NodeInterface } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";
import { BaseOutputNode, BaseOutputNodeInputs, BaseOutputNodeOutputs } from "./BaseOutputNode";

interface Inputs extends BaseOutputNodeInputs {
    color: Color;
    redAddress: number;
    greenAddress: number;
    blueAddress: number;
}

interface Outputs extends BaseOutputNodeOutputs<IDmxOutputData> {
    preview: Color[];
}

export class DmxSpotOutputNode extends BaseOutputNode<IDmxOutputData, Inputs, Outputs> {
    public type = "DMX Spot Output";
    public title = this.type;

    public inputs = {
        output: new SelectInterface("Output", "", []).setPort(false),
        color: new ColorSingleInterface("Color"),
        redAddress: new IntegerInterface("Red address", 1, 1, 512),
        greenAddress: new IntegerInterface("Green address", 2, 1, 512),
        blueAddress: new IntegerInterface("Blue address", 3, 1, 512),
    };

    public outputs = {
        preview: new PreviewInterface("Preview"),
        outputId: new NodeInterface<string | undefined>("OutputId", undefined).setPort(false),
        data: new NodeInterface<IDmxOutputData | undefined>("Data", undefined).setPort(false),
    };

    public constructor() {
        super([OutputType.DMX]);
    }

    public calculate: CalculateFunction<Inputs, Outputs> = (inputs) => {
        const { color } = inputs;
        const redAddress = Math.floor(inputs.redAddress) ?? -1;
        const greenAddress = Math.floor(inputs.greenAddress) ?? -1;
        const blueAddress = Math.floor(inputs.blueAddress) ?? -1;

        const channels = new Map<number, number>();
        if (redAddress > 0 && greenAddress > 0 && blueAddress > 0) {
            channels.set(redAddress, color[0]);
            channels.set(greenAddress, color[1]);
            channels.set(blueAddress, color[2]);
        }
        return { preview: [color], ...this.afterCalculate(inputs, { channels }) };
    };
}
