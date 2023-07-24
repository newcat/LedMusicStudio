import { NumberInterface } from "@/graph/interfaces";
import { CalculateFunction } from "@baklavajs/core";
import { SelectInterface } from "@baklavajs/renderer-vue";
import { LmsCalculationContext } from "../../types";
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

    public inputs = {
        track: new SelectInterface("Track", "", []).setPort(false),
        min: new NumberInterface("Min", 0),
        max: new NumberInterface("Max", 1),
    };

    public outputs = {
        value: new NumberInterface("Value", 0).setComponent(undefined),
    };

    public constructor() {
        super();
        this.title = this.type;
        this.initializeIo();
    }

    public calculate: CalculateFunction<Inputs, Outputs, LmsCalculationContext> = (inputs, { globalValues }) => {
        const { min, max } = inputs;
        const trackValue = this.getTrackValue(inputs, globalValues);
        let value = 0;
        if (typeof trackValue === "number") {
            value = trackValue;
        }
        return { value: min + value * (max - min) };
    };
}
