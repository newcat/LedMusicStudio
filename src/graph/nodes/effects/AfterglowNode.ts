import { CalculateFunction, Node } from "baklavajs";
import { ColorArrayInterface, NumberInterface } from "@/graph/interfaces";
import { Color, mix, blend } from "../../colors";
import { LmsCalculationContext } from "../../types";
import { perFixtureState } from "../perFixtureState";

const THRESHOLD = 4;

interface Inputs {
    input: Color[];
    strength: number;
}

interface Outputs {
    output: Color[];
}

export class AfterglowNode extends Node<Inputs, Outputs> {
    public type = "Afterglow";

    public inputs = {
        input: new ColorArrayInterface("Input"),
        strength: new NumberInterface("Strength", 0.75),
    };

    public outputs = {
        output: new ColorArrayInterface("Output"),
    };

    public constructor() {
        super();
        this.title = this.type;
        this.initializeIo();
    }

    public calculate: CalculateFunction<Inputs, Outputs, LmsCalculationContext> = ({ input, strength }, context) => {
        const { resolution } = context.globalValues;
        // one buffer per fixture of a per-fixture run (feature 004)
        const state = perFixtureState(this, context, () => ({ buffer: [] as Color[] }));
        if (resolution !== state.buffer.length) {
            state.buffer = this.createBuffer(resolution);
        }
        const buffer = state.buffer;

        const result = [];
        for (let i = 0; i < resolution; i++) {
            const a = i < input.length ? input[i] : ([0, 0, 0] as Color);
            let b = i < buffer.length ? buffer[i] : ([0, 0, 0] as Color);
            b = mix(b, [0, 0, 0], 1 - strength);
            const c = blend(b, a, "lighten");
            buffer[i] = Math.max(...c) < THRESHOLD ? a : c;
            result[i] = c;
        }

        return { output: result };
    };

    private createBuffer(resolution: number): Color[] {
        const buffer: Color[] = [];
        for (let i = 0; i < resolution; i++) {
            buffer.push([0, 0, 0]);
        }
        return buffer;
    }
}
