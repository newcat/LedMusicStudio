import { NumberInterface } from "@/graph/interfaces";
import PeakOptionVue from "@/graph/options/PeakOption.vue";
import { defineNode, NodeInterface } from "@baklavajs/core";
import { markRaw } from "vue";
import { ICalculationData } from "../../types";

export const PeakNode = defineNode({
    type: "Peak",
    inputs: {
        minDb: () => new NumberInterface("Min Decibels", -60, -200, 0),
        maxDb: () => new NumberInterface("Max Decibels", 0, -200, 0),
    },
    outputs: {
        preview: () => new NodeInterface("Peak", 0).setComponent(markRaw(PeakOptionVue)).setPort(false),
        peak: () => new NumberInterface("Peak", 0),
    },
    calculate({ minDb, maxDb }, { timeDomainData, sampleRate }: ICalculationData) {
        const sampleSize = Math.max(timeDomainData.length, (sampleRate / 1000) * 30);
        let sum = 0;
        for (let i = timeDomainData.length - sampleSize; i < timeDomainData.length; i++) {
            sum += timeDomainData[i] * timeDomainData[i];
        }
        const rms = Math.sqrt(sum / (sampleSize / 2));
        const db = 20 * Math.log10(rms);
        const v = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));

        return { preview: v, peak: v };
    },
});
