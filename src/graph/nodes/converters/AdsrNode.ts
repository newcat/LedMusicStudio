import { CalculateFunction, Node } from "baklavajs";
import { CheckboxInterface, NumberInterface } from "@/graph/interfaces";
import { LmsCalculationContext } from "@/graph/types";
import { perFixtureState } from "../perFixtureState";

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

    constructor() {
        super();
        this.title = this.type;
        this.initializeIo();
    }

    public override calculate: CalculateFunction<Inputs, Outputs, LmsCalculationContext> = (inputs, context) => {
        const { globalValues } = context;
        const { trigger, attack, decay, sustain, release } = inputs;
        // envelope state per fixture of a per-fixture run (feature 004)
        const s = perFixtureState(this, context, () => ({ phase: "None" as Phase, value: 0, startValue: 0, startFrame: 0 }));

        const offsetFromStartInSeconds = () => Math.max(0, (globalValues.position - s.startFrame) / globalValues.fps);

        const enterPhase = (phase: Phase) => {
            s.phase = phase;
            s.startFrame = globalValues.position;
            s.startValue = s.value;
        };
        let hasPhaseChanged = true;
        while (hasPhaseChanged) {
            const oldPhase = s.phase;
            if (s.phase === "None") {
                if (trigger) {
                    enterPhase("Attack");
                }
            } else if (s.phase === "Attack") {
                if (!trigger) {
                    enterPhase("Release");
                } else if (offsetFromStartInSeconds() >= attack) {
                    enterPhase("Decay");
                }
            } else if (s.phase === "Decay") {
                if (!trigger) {
                    enterPhase("Release");
                } else if (offsetFromStartInSeconds() >= decay) {
                    enterPhase("Sustain");
                }
            } else if (s.phase === "Sustain") {
                if (!trigger) {
                    enterPhase("Release");
                }
            } else if (s.phase === "Release") {
                if (trigger) {
                    enterPhase("Attack");
                } else if (offsetFromStartInSeconds() >= release) {
                    enterPhase("None");
                }
            }
            hasPhaseChanged = oldPhase !== s.phase;
        }

        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        let value = 0;
        if (s.phase === "Attack") {
            value = lerp(s.startValue, 1, offsetFromStartInSeconds() / attack);
        } else if (s.phase === "Decay") {
            value = lerp(s.startValue, sustain, offsetFromStartInSeconds() / decay);
        } else if (s.phase === "Sustain") {
            value = sustain;
        } else if (s.phase === "Release") {
            value = lerp(s.startValue, 0, offsetFromStartInSeconds() / release);
        }

        if (isNaN(value)) {
            console.warn("ADSR value is NaN");
            value = 0;
        }
        s.value = value;

        return { value };
    };
}
