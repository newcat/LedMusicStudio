import { Node } from "@baklavajs/core";
import { ICalculationData } from "../../types";

export class PeakNode extends Node {
    public type = "Peak";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("Min Decibels", "NumberOption", -60, { type: "number", min: -200, max: 0 });
        this.addInputInterface("Max Decibels", "NumberOption", 0, { type: "number", min: -200, max: 0 });
        this.addOption("Peak", "PeakOption", 0);
        this.addOutputInterface("Peak", { type: "number" });
    }

    public calculate(data: ICalculationData) {
        const { timeDomainData, sampleRate } = data;

        const sampleSize = Math.max(timeDomainData.length, (sampleRate / 1000) * 30);
        let sum = 0;
        for (let i = timeDomainData.length - sampleSize; i < timeDomainData.length; i++) {
            sum += timeDomainData[i] * timeDomainData[i];
        }
        const rms = Math.sqrt(sum / (sampleSize / 2));
        const db = 20 * Math.log10(rms);

        const minDb = this.getInterface("Min Decibels").value;
        const maxDb = this.getInterface("Max Decibels").value;
        const v = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));

        this.setOptionValue("Peak", v);
        this.getInterface("Peak").value = v;
    }
}
