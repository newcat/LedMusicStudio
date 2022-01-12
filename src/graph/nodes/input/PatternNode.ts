import { NumberInterface } from "@/graph/interfaces";
import { CalculateFunction } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";
import { ICalculationData } from "../../types";
import { TrackInputNode, TrackInputNodeInputs } from "./TrackInputNode";

interface Outputs {
    singleNote: number;
}

export class PatternNode extends TrackInputNode<TrackInputNodeInputs, Outputs> {
    public type = "Automation";
    public title = this.type;

    public inputs = {
        track: new SelectInterface("Track", "", []).setPort(false),
    };

    public outputs = {
        singleNote: new NumberInterface("Value", 0),
    };

    public constructor() {
        super();
        this.initializeIo();
    }

    public calculate: CalculateFunction<TrackInputNodeInputs, Outputs> = (inputs, data: ICalculationData) => {
        const trackValue = this.getTrackValue(inputs, data);
        let value = 0;
        if (Array.isArray(trackValue) && trackValue.length > 0 && typeof trackValue[0].value === "number") {
            value = trackValue[0].value;
        }
        return { singleNote: value };
    };
}
