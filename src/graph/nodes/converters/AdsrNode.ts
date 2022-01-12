import { CheckboxInterface, NumberInterface } from "@/graph/interfaces";
import { ICalculationData } from "@/graph/types";
import { CalculateFunction, Node } from "@baklavajs/core";

type Phase = "Attack" | "Decay" | "Sustain" | "Release" | "None";

interface Inputs {
    trigger: boolean;
    attack: number;
    decay: number;
    sustain: number;
    release: number;
}

interface Outputs {
    value: number;
}

export class AdsrNode extends Node<Inputs, Outputs> {
    public type = "ADSR";
    public title = this.type;

    public inputs = {
        trigger: new CheckboxInterface("Trigger", false),
        attack: new NumberInterface("Attack", 0.2, 0),
        decay: new NumberInterface("Decay", 0.3, 0),
        sustain: new NumberInterface("Sustain", 0.7, 0, 1),
        release: new NumberInterface("Release", 0.5, 0),
    };

    public outputs = {
        value: new NumberInterface("Value", 0),
    };

    private phase: Phase = "None";
    private value = 0;
    private startValue = 0;
    private startFrame = 0;

    constructor() {
        super();
        this.initializeIo();
    }

    public override calculate: CalculateFunction<Inputs, Outputs> = (inputs, data: ICalculationData) => {
        const { trigger, attack, decay, sustain, release } = inputs;

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

        return { value };
    };
}
