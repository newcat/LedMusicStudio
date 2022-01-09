import { ICalculationData } from "../../types";
import { TrackInputNode } from "./TrackInputNode";

export class PatternNode extends TrackInputNode {
    public type = "Pattern";
    public name = this.type;

    public constructor() {
        super();
        this.addOutputInterface("Single Note", { type: "number" });
    }

    public calculate(data: ICalculationData) {
        const trackValue = this.getTrackValue(data);
        let value = 0;
        if (Array.isArray(trackValue) && trackValue.length > 0 && typeof trackValue[0].value === "number") {
            value = trackValue[0].value;
        }
        this.getInterface("Single Note").value = value;
    }
}
