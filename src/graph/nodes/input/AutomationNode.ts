import { ICalculationData } from "../../types";
import { TrackInputNode } from "./TrackInputNode";

export class AutomationNode extends TrackInputNode {
    public type = "Automation";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("Min", "NumberOption", 0, { type: "number" });
        this.addInputInterface("Max", "NumberOption", 1, { type: "number" });
        this.addOutputInterface("Value", { type: "number" });
    }

    public calculate(data: ICalculationData) {
        const min = this.getInterface("Min").value;
        const max = this.getInterface("Max").value;
        const trackValue = this.getTrackValue(data);
        let value = 0;
        if (typeof trackValue === "number") {
            value = trackValue;
        }
        this.getInterface("Value").value = min + value * (max - min);
    }
}
