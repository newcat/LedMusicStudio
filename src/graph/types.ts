import { CalculationContext } from "baklavajs";
import { INote } from "@/pattern";

export interface ICalculationData {
    resolution: number;
    fps: number;
    position: number;
    sampleRate: number;
    timeDomainData: Float32Array;
    frequencyData: Float32Array;
    trackValues: Map<string, number | INote[]>;
    relativeTrackItemProgress: number;
}

export type LmsCalculationContext = CalculationContext<ICalculationData>;
