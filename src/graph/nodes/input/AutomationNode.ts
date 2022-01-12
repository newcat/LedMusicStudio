import { NumberInterface } from "@/graph/interfaces";
import { CalculateFunction } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";
import { ICalculationData } from "../../types";
import { TrackInputNode, TrackInputNodeInputs } from "./TrackInputNode";

interface Inputs extends TrackInputNodeInputs {
    min: number;
    max: number;
}

interface Outputs {
    value: number;
}

export class AutomationNode extends TrackInputNode<Inputs, Outputs> {
    public type = "Automation";
    public title = this.type;

    public inputs = {
        track: new SelectInterface("Track", "", []).setPort(false),
        min: new NumberInterface("Min", 0),
        max: new NumberInterface("Max", 1),
    };

    public outputs = {
        value: new NumberInterface("Value", 0),
    };

    public constructor() {
        super();
        this.initializeIo();
    }

    public calculate: CalculateFunction<Inputs, Outputs> = (inputs, data: ICalculationData) => {
        const { min, max } = inputs;
        const trackValue = this.getTrackValue(inputs, data);
        let value = 0;
        if (typeof trackValue === "number") {
            value = trackValue;
        }
        return { value: min + value * (max - min) };
    };
}
