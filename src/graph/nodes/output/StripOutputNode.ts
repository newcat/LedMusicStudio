import { Color } from "@/graph/colors";
import { ColorArrayInterface, PreviewInterface } from "@/graph/interfaces";
import { OutputType } from "@/output";
import { CalculateFunction, NodeInterface } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";
import { BaseOutputNode, BaseOutputNodeInputs, BaseOutputNodeOutputs } from "./BaseOutputNode";

interface IStripOutputData {
    colors: Color[];
}

interface Inputs extends BaseOutputNodeInputs {
    colors: Color[];
}

interface Outputs extends BaseOutputNodeOutputs<IStripOutputData> {
    preview: Color[];
}

export class StripOutputNode extends BaseOutputNode<IStripOutputData, Inputs, Outputs> {
    public type = "Strip Output";
    public title = this.type;

    public inputs = {
        output: new SelectInterface("Output", "", []).setPort(false),
        colors: new ColorArrayInterface("Color"),
    };

    public outputs = {
        preview: new PreviewInterface("Preview"),
        outputId: new NodeInterface<string | undefined>("OutputId", undefined).setPort(false),
        data: new NodeInterface<IStripOutputData | undefined>("Data", undefined).setPort(false),
    };

    public constructor() {
        super([OutputType.DUMMY, OutputType.WLED, OutputType.RAZER_CHROMA]);
        this.initializeIo();
    }

    public calculate: CalculateFunction<Inputs, Outputs> = (inputs) => {
        return { preview: inputs.colors, ...this.afterCalculate(inputs, { colors: inputs.colors }) };
    };
}
