import { markRaw } from "vue";
import { defineNode, NodeInterface } from "baklavajs";
import { NumberInterface } from "@/graph/interfaces";
import PeakOptionVue from "@/graph/options/PeakOption.vue";
import { LmsCalculationContext } from "../../types";

export const PeakNode = defineNode({
    type: "Peak",
    inputs: {
        minDb: () => new NumberInterface("Min Decibels", -60, -200, 0),
        maxDb: () => new NumberInterface("Max Decibels", 0, -200, 0),
    },
    outputs: {
        preview: () => new NodeInterface("Peak", 0).setComponent(markRaw(PeakOptionVue)).setPort(false),
        peak: () => new NumberInterface("Peak", 0).setComponent(undefined),
    },
    calculate({ minDb, maxDb }, context: LmsCalculationContext) {
        const { timeDomainData, sampleRate, fps } = context.globalValues;
        const sampleSize = Math.min(timeDomainData.length, (sampleRate / 1000) * fps);
        const max = Math.max(...timeDomainData.slice(-sampleSize));
        const db = 20 * Math.log10(Math.sqrt(max));
        const v = Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));

        return { preview: v, peak: v };
    },
});
