import { Node } from "@baklavajs/core";
import { makeNoise2D } from "open-simplex-noise";
import { Color, fromChroma, chroma } from "../../colors";
import { ICalculationData } from "../../types";

export class NoiseNode extends Node {
    public type = "Noise";
    public name = this.type;

    private hueNoise = makeNoise2D(Math.random() * 100000);
    private valueNoise = makeNoise2D(Math.random() * 100000);
    private timer = 0;

    public constructor() {
        super();
        this.addInputInterface("Space Freq", "NumberOption", 10, { type: "number", min: 0 });
        this.addInputInterface("Time Freq", "NumberOption", 0.1, { type: "number", min: 0 });
        this.addInputInterface("Magnitude", "SliderOption", 1, { type: "number", min: 0, max: 1 });
        this.addInputInterface("Coloring", "SliderOption", 0, { type: "number", min: 0, max: 1 });
        this.addOutputInterface("Colors", { type: "color_array" });
    }

    public calculate(data: ICalculationData) {
        const { resolution } = data;

        const spaceFreq = Math.max(this.getInterface("Space Freq").value, 0);
        const timeFreq = Math.max(this.getInterface("Time Freq").value, 0);
        const magnitude = this.clamp(this.getInterface("Magnitude").value, 0, 1);
        const coloring = this.clamp(this.getInterface("Coloring").value, 0, 1);

        const result: Color[] = new Array(resolution);

        for (let i = 0; i < resolution; i++) {
            const x = (i / resolution) * spaceFreq;
            const y = this.timer * timeFreq;
            const h = this.hueNoise(x, y) * 360;
            const v = this.valueNoise(x, y) * magnitude;
            result[i] = fromChroma(chroma(h, coloring, v, "hsv"));
        }

        this.getInterface("Colors").value = result;
        this.timer++;
    }

    private clamp(v: number, min: number, max: number) {
        if (!Number.isFinite(v)) {
            return 0;
        }
        return Math.min(max, Math.max(min, v));
    }
}
