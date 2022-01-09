import { Node } from "@baklavajs/core";
import { ICalculationData } from "../../types";

export class SpectrumNode extends Node {
    public type = "Spectrum";
    public name = this.type;

    public constructor() {
        super();
        this.addInputInterface("Min Freq", "NumberOption", 0, { type: "number" });
        this.addInputInterface("Max Freq", "NumberOption", 20000, { type: "number" });
        this.addInputInterface("Min Decibels", "NumberOption", -60, { type: "number", min: -200, max: 0 });
        this.addInputInterface("Max Decibels", "NumberOption", -20, { type: "number", min: -200, max: 0 });
        this.addOption("Spectrum", "SpectrumOption", null);
        this.addOutputInterface("Average", { type: "number" });
        this.addOutputInterface("Peak", { type: "number" });
    }

    public calculate(data: ICalculationData) {
        const { frequencyData, sampleRate } = data;

        const fftSize = frequencyData.length;
        const minIndex = this.clamp(
            this.getBinIndexByFrequency(this.getInterface("Min Freq").value, sampleRate, fftSize),
            1,
            frequencyData.length - 1
        );
        const maxIndex = this.clamp(
            this.getBinIndexByFrequency(this.getInterface("Max Freq").value, sampleRate, fftSize),
            1,
            frequencyData.length - 1
        );

        const maxDb = this.clamp(this.getInterface("Max Decibels").value, -200, 0);
        const minDb = this.clamp(this.getInterface("Min Decibels").value, -200, maxDb);

        const normalizedData = new Float32Array(maxIndex - minIndex + 1);
        let max = 0;
        let sum = 0;
        for (let i = 0; minIndex + i <= maxIndex; i++) {
            const normalizedValue = this.clamp((frequencyData[minIndex + i] - minDb) / (maxDb - minDb), 0, 1);
            normalizedData[i] = normalizedValue;
            if (normalizedValue > max) {
                max = normalizedValue;
            }
            sum += normalizedValue;
        }

        this.setOptionValue("Spectrum", normalizedData);

        this.getInterface("Peak").value = max;
        this.getInterface("Average").value = sum / normalizedData.length;
    }

    private getBinIndexByFrequency(f: number, sampleRate: number, fftSize: number) {
        return Math.round((f * fftSize) / sampleRate);
    }

    private clamp(v: number, min: number, max: number) {
        return Math.max(min, Math.min(max, v));
    }
}
