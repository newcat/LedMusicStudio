import { CalculateFunction, SelectInterface } from "baklavajs";
import { NumberInterface } from "@/graph/interfaces";
import { LmsCalculationContext } from "../../types";
import { TrackInputNode, TrackInputNodeInputs } from "./TrackInputNode";

interface Outputs {
    singleNote: number;
}

export class PatternNode extends TrackInputNode<TrackInputNodeInputs, Outputs> {
    public type = "Pattern";
    protected _title = this.type;

    public inputs = {
        track: new SelectInterface("Track", "", []).setPort(false),
    };

    public outputs = {
        singleNote: new NumberInterface("Value", 0).setComponent(undefined),
    };

    public constructor() {
        super();
        this.initializeIo();
    }

    public calculate: CalculateFunction<TrackInputNodeInputs, Outputs, LmsCalculationContext> = (inputs, { globalValues }) => {
        const trackValue = this.getTrackValue(inputs, globalValues);
        let value = 0;
        if (Array.isArray(trackValue) && trackValue.length > 0 && typeof trackValue[0].value === "number") {
            value = trackValue[0].value;
        }
        return { singleNote: value };
    };
}
