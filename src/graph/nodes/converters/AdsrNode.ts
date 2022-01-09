import { ICalculationData } from "@/graph/types";
import { Node } from "@baklavajs/core";

type Phase = "Attack" | "Decay" | "Sustain" | "Release" | "None";

export class AdsrNode extends Node {
    type = "ADSR";
    name = this.type;

    private phase: Phase = "None";
    private value = 0;
    private startValue = 0;
    private startFrame = 0;

    constructor() {
        super();
        this.addInputInterface("Trigger", "CheckboxOption", false, { type: "boolean" });
        this.addInputInterface("Attack", "NumberOption", 0.2, { type: "number", min: 0 });
        this.addInputInterface("Decay", "NumberOption", 0.3, { type: "number", min: 0 });
        this.addInputInterface("Sustain", "NumberOption", 0.7, { type: "number", min: 0, max: 1 });
        this.addInputInterface("Release", "NumberOption", 0.5, { type: "number", min: 0 });
        this.addOutputInterface("Value", { type: "number" });
    }

    calculate(data: ICalculationData) {
        const trigger: boolean = this.getInterface("Trigger").value;
        const attack: number = this.getInterface("Attack").value;
        const decay: number = this.getInterface("Decay").value;
        const sustain: number = this.getInterface("Sustain").value;
        const release: number = this.getInterface("Release").value;

        let offsetFromStartInSeconds = Math.max(0, (data.position - this.startFrame) / data.fps);

        // Handle phase transitions
        if (trigger && (this.phase === "None" || this.phase === "Release")) {
            this.phase = "Attack";
            this.startFrame = data.position;
            this.startValue = this.value;
        } else if (!trigger && this.phase !== "Release" && this.phase !== "None") {
            this.phase = "Release";
            this.startValue = this.value;
            this.startFrame = data.position;
        } else if (!trigger && this.phase === "Release" && offsetFromStartInSeconds > release) {
            this.phase = "None";
        } else if (this.phase === "Attack" && offsetFromStartInSeconds > attack) {
            this.phase = "Decay";
        } else if (this.phase === "Decay" && offsetFromStartInSeconds > attack + decay) {
            this.phase = "Sustain";
        }

        // as the phase transition could have changed the start frame, recalculate
        offsetFromStartInSeconds = Math.max(0, (data.position - this.startFrame) / data.fps);

        let value = 0;
        if (this.phase === "Attack") {
            value = this.startValue + (offsetFromStartInSeconds / attack) * (1 - this.startValue);
        } else if (this.phase === "Decay") {
            value = 1 - (offsetFromStartInSeconds - attack) / decay + sustain;
        } else if (this.phase === "Sustain") {
            value = sustain;
        } else if (this.phase === "Release") {
            value = this.startValue - offsetFromStartInSeconds / release;
        }

        this.value = value;
        this.getInterface("Value").value = value;
    }
}
