import { CalculationContext } from "baklavajs";
import { INote } from "@/pattern";
import type { Vec3 } from "@/scene/model/types";

/** The fixture of a per-fixture graph run (feature 004, R7); unset outside per-fixture runs. */
export interface ICalculationFixture {
    index: number;
    /** 0 for the first, 1 for the last, 0 for a single fixture. */
    normalizedIndex: number;
    position: Vec3 | null;
    groupSize: number;
    fixtureId: string;
}

export interface ICalculationData {
    resolution: number;
    fps: number;
    position: number;
    sampleRate: number;
    timeDomainData: Float32Array;
    frequencyData: Float32Array;
    trackValues: Map<string, number | INote[]>;
    relativeTrackItemProgress: number;
    fixture?: ICalculationFixture;
}

export type LmsCalculationContext = CalculationContext<ICalculationData>;
