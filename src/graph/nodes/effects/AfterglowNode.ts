import { ColorArrayInterface, NumberInterface } from "@/graph/interfaces";
import { CalculateFunction, Node } from "@baklavajs/core";
import { Color, mix, blend } from "../../colors";
import { LmsCalculationContext } from "../../types";

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
    public title = this.type;

    public inputs = {
        input: new ColorArrayInterface("Input"),
        strength: new NumberInterface("Strength", 0.75),
    };

    public outputs = {
        output: new ColorArrayInterface("Output"),
    };

    private buffer: Color[] = [];

    public constructor() {
        super();
        this.initializeIo();
    }

    public calculate: CalculateFunction<Inputs, Outputs, LmsCalculationContext> = ({ input, strength }, { globalValues }) => {
        const { resolution } = globalValues;
        if (resolution !== this.buffer.length) {
            this.initializeBuffer(resolution);
        }

        const result = [];
        for (let i = 0; i < resolution; i++) {
            const a = i < input.length ? input[i] : ([0, 0, 0] as Color);
            let b = i < this.buffer.length ? this.buffer[i] : ([0, 0, 0] as Color);
            b = mix(b, [0, 0, 0], 1 - strength);
            const c = blend(b, a, "lighten");
            this.buffer[i] = Math.max(...c) < THRESHOLD ? a : c;
            result[i] = c;
        }

        return { output: result };
    };

    private initializeBuffer(resolution: number) {
        this.buffer = [];
        for (let i = 0; i < resolution; i++) {
            this.buffer.push([0, 0, 0]);
        }
    }
}
