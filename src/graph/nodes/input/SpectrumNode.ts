import { NumberInterface } from "@/graph/interfaces";
import SpectrumOptionVue from "@/graph/options/SpectrumOption.vue";
import { defineNode, NodeInterface } from "@baklavajs/core";
import { markRaw } from "vue";
import { LmsCalculationContext } from "../../types";

function getBinIndexByFrequency(f: number, sampleRate: number, fftSize: number) {
    return Math.round((f * fftSize) / sampleRate);
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

export const SpectrumNode = defineNode({
    type: "Spectrum",
    inputs: {
        minFreq: () => new NumberInterface("Min Freq", 0, 0),
        maxFreq: () => new NumberInterface("Max Freq", 20000, 0),
        minDb: () => new NumberInterface("Min Decibels", -60, -200, 0),
        maxDb: () => new NumberInterface("Max Decibels", -20, -200, 0),
    },
    outputs: {
        spectrum: () =>
            new NodeInterface<Float32Array>("Spectrum", new Float32Array()).setComponent(markRaw(SpectrumOptionVue)).setPort(false),
        average: () => new NumberInterface("Average", 0),
        peak: () => new NumberInterface("Peak", 0),
    },
    calculate(inputs, context: LmsCalculationContext) {
        const { frequencyData, sampleRate } = context.globalValues;
        const fftSize = frequencyData.length;
        const minIndex = clamp(getBinIndexByFrequency(inputs.minFreq, sampleRate, fftSize), 1, frequencyData.length - 1);
        const maxIndex = clamp(getBinIndexByFrequency(inputs.maxFreq, sampleRate, fftSize), 1, frequencyData.length - 1);

        const maxDb = clamp(inputs.maxDb, -200, 0);
        const minDb = clamp(inputs.minDb, -200, maxDb);

        const normalizedData = new Float32Array(maxIndex - minIndex + 1);
        let max = 0;
        let sum = 0;
        for (let i = 0; minIndex + i <= maxIndex; i++) {
            const normalizedValue = clamp((frequencyData[minIndex + i] - minDb) / (maxDb - minDb), 0, 1);
            normalizedData[i] = normalizedValue;
            if (normalizedValue > max) {
                max = normalizedValue;
            }
            sum += normalizedValue;
        }

        return {
            spectrum: normalizedData,
            average: sum / normalizedData.length,
            peak: max,
        };
    },
});
