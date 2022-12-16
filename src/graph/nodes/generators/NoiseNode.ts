import { ColorArrayInterface, NumberInterface, SliderInterface } from "@/graph/interfaces";
import { CalculateFunction, Node } from "@baklavajs/core";
import { makeNoise2D } from "open-simplex-noise";
import { Color, fromChroma, chroma } from "../../colors";
import { LmsCalculationContext } from "../../types";

interface Inputs {
    spaceFreq: number;
    timeFreq: number;
    magnitude: number;
    coloring: number;
}

interface Outputs {
    colors: Color[];
}

export class NoiseNode extends Node<Inputs, Outputs> {
    public type = "Noise";
    public title = this.type;

    public inputs = {
        spaceFreq: new NumberInterface("Space Freq", 10, 0),
        timeFreq: new NumberInterface("Time Freq", 0.1, 0),
        magnitude: new SliderInterface("Magnitude", 1, 0, 1),
        coloring: new SliderInterface("Coloring", 0, 0, 1),
    };

    public outputs = {
        colors: new ColorArrayInterface("Colors"),
    };

    private hueNoise = makeNoise2D(Math.random() * 100000);
    private valueNoise = makeNoise2D(Math.random() * 100000);
    private timer = 0;

    public constructor() {
        super();
        this.initializeIo();
    }

    public calculate: CalculateFunction<Inputs, Outputs> = (inputs, data: LmsCalculationContext) => {
        const { resolution } = data.globalValues;

        const spaceFreq = Math.max(inputs.spaceFreq, 0);
        const timeFreq = Math.max(inputs.timeFreq, 0);
        const magnitude = this.clamp(inputs.magnitude, 0, 1);
        const coloring = this.clamp(inputs.coloring, 0, 1);

        const result: Color[] = new Array(resolution);

        for (let i = 0; i < resolution; i++) {
            const x = (i / resolution) * spaceFreq;
            const y = this.timer;
            const h = this.hueNoise(x, y) * 360;
            const v = this.valueNoise(x, y) * magnitude;
            result[i] = fromChroma(chroma(h, coloring, v, "hsv"));
        }

        this.timer += timeFreq;
        return { colors: result };
    };

    private clamp(v: number, min: number, max: number) {
        if (!Number.isFinite(v)) {
            return 0;
        }
        return Math.min(max, Math.max(min, v));
    }
}
