import { CalculationContext } from "@baklavajs/core";
import { DependencyEngine } from "@baklavajs/engine";
import { INote } from "@/pattern";

export interface ICalculationData {
    resolution: number;
    fps: number;
    position: number;
    sampleRate: number;
    timeDomainData: Float32Array;
    frequencyData: Float32Array;
    trackValues: Map<string, number | INote[]>;
}

export type LmsCalculationContext = CalculationContext<ICalculationData, DependencyEngine>;
