import { CalculateFunction, NodeInterface } from "baklavajs";
import { FixtureType } from "@/stage";
import { Color } from "@/graph/colors";
import { ColorArrayInterface, PreviewInterface } from "@/graph/interfaces";
import { SelectFixtureInterface } from "@/graph/interfaces/SelectFixtureInterface";
import { BaseOutputNode, BaseOutputNodeInputs, BaseOutputNodeOutputs } from "./BaseOutputNode";

interface Inputs extends BaseOutputNodeInputs {
    colors: Color[];
}

interface Outputs extends BaseOutputNodeOutputs<Color[]> {
    preview: Color[];
}

export class StripOutputNode extends BaseOutputNode<Color[], Inputs, Outputs> {
    public type = "Strip Output";
    public _title = this.type;

    public inputs = {
        fixtureId: new SelectFixtureInterface([FixtureType.LED_STRIP]).setPort(false),
        colors: new ColorArrayInterface("Color"),
    };

    public outputs = {
        preview: new PreviewInterface("Preview"),
        fixtureId: new NodeInterface<string>("FixtureId", "").setHidden(true),
        data: new NodeInterface<Color[]>("Data", []).setHidden(true),
    };

    public constructor() {
        super();
        this.initializeIo();
    }

    public calculate: CalculateFunction<Inputs, Outputs> = ({ fixtureId, colors }) => {
        return { preview: colors, data: colors, fixtureId };
    };
}
