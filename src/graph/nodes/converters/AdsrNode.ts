import { CalculateFunction, Node } from "baklavajs";
import { CheckboxInterface, NumberInterface } from "@/graph/interfaces";
import { LmsCalculationContext } from "@/graph/types";

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

    public inputs = {
        trigger: new CheckboxInterface("Trigger", false),
        attack: new NumberInterface("Attack", 0.2, 0),
        decay: new NumberInterface("Decay", 0.3, 0),
        sustain: new NumberInterface("Sustain", 0.7, 0, 1),
        release: new NumberInterface("Release", 0.5, 0),
    };

    public outputs = {
        value: new NumberInterface("Value", 0).setComponent(undefined),
    };

    private phase: Phase = "None";
    private value = 0;
    private startValue = 0;
    private startFrame = 0;

    constructor() {
        super();
        this.title = this.type;
        this.initializeIo();
    }

    public override calculate: CalculateFunction<Inputs, Outputs, LmsCalculationContext> = (inputs, { globalValues }) => {
        const { trigger, attack, decay, sustain, release } = inputs;

        const offsetFromStartInSeconds = () => Math.max(0, (globalValues.position - this.startFrame) / globalValues.fps);

        const enterPhase = (phase: Phase) => {
            this.phase = phase;
            this.startFrame = globalValues.position;
            this.startValue = this.value;
        };
        let hasPhaseChanged = true;
        while (hasPhaseChanged) {
            const oldPhase = this.phase;
            if (this.phase === "None") {
                if (trigger) {
                    enterPhase("Attack");
                }
            } else if (this.phase === "Attack") {
                if (!trigger) {
                    enterPhase("Release");
                } else if (offsetFromStartInSeconds() >= attack) {
                    enterPhase("Decay");
                }
            } else if (this.phase === "Decay") {
                if (!trigger) {
                    enterPhase("Release");
                } else if (offsetFromStartInSeconds() >= decay) {
                    enterPhase("Sustain");
                }
            } else if (this.phase === "Sustain") {
                if (!trigger) {
                    enterPhase("Release");
                }
            } else if (this.phase === "Release") {
                if (trigger) {
                    enterPhase("Attack");
                } else if (offsetFromStartInSeconds() >= release) {
                    enterPhase("None");
                }
            }
            hasPhaseChanged = oldPhase !== this.phase;
        }

        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        let value = 0;
        if (this.phase === "Attack") {
            value = lerp(this.startValue, 1, offsetFromStartInSeconds() / attack);
        } else if (this.phase === "Decay") {
            value = lerp(this.startValue, sustain, offsetFromStartInSeconds() / decay);
        } else if (this.phase === "Sustain") {
            value = sustain;
        } else if (this.phase === "Release") {
            value = lerp(this.startValue, 0, offsetFromStartInSeconds() / release);
        }

        if (isNaN(value)) {
            console.warn("ADSR value is NaN");
            value = 0;
        }
        this.value = value;

        return { value };
    };
}
