import FFT from "fft.js";
import { CalculationResult, applyResult } from "baklavajs";

import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { useGlobalState } from "@/globalState";
import { GraphLibraryItem, ICalculationData } from "@/graph";
import { INote, PatternLibraryItem } from "@/pattern";
import { BaseFixture, useStage } from "@/stage";
import type { Item } from "@/timeline";
import {
    isAudioLibraryItem,
    isAutomationLibraryItem,
    isGraphLibraryItem,
    isPatternLibraryItem,
    isScriptLibraryItem,
    unitToSeconds,
} from "@/utils";
import { ScriptLibraryItem } from "@/scripting";

const FFT_SIZE = 8192;
interface AudioData {
    timeDomainData: Float32Array;
    frequencyData: Float32Array;
}

export class BaseTimelineProcessor {
    protected readonly globalState = useGlobalState();
    protected readonly stage = useStage();
    private readonly fft = new FFT(FFT_SIZE);
    private readonly fftWindow = this.getFftWindow();

    private activeItems: Item[] = [];

    public async process(unit: number) {
        const currentActiveItems = this.globalState.timeline.items.filter((i) => i.start <= unit && i.end >= unit) as Item[];

        const newActiveItems = currentActiveItems.filter((i) => !this.activeItems.includes(i));
        for (const item of newActiveItems) {
            await this.activate(item);
        }

        const newInactiveItems = this.activeItems.filter((i) => !currentActiveItems.includes(i));
        for (const item of newInactiveItems) {
            await this.deactivate(item);
        }

        this.activeItems = currentActiveItems;

        /** maps trackId -> value */
        const trackValues = this.getTrackValues(currentActiveItems, unit);

        let timeDomainData: Float32Array = new Float32Array(FFT_SIZE);
        let frequencyData: Float32Array = new Float32Array(FFT_SIZE);
        // TODO: handle multiple audio items?
        const audioItem = currentActiveItems.find((i) => isAudioLibraryItem(i.libraryItem));
        if (audioItem) {
            const audioData = this.getAudioData(audioItem.libraryItem as AudioLibraryItem, audioItem.start, unit);
            if (audioData) {
                timeDomainData = audioData.timeDomainData;
                frequencyData = audioData.frequencyData;
            }
        }

        const calculationData: Omit<ICalculationData, "relativeTrackItemProgress"> = {
            resolution: this.globalState.resolution,
            fps: this.globalState.fps,
            position: unit,
            sampleRate: AudioLibraryItem.sampleRate,
            timeDomainData: timeDomainData,
            frequencyData: frequencyData,
            trackValues,
        };

        const uncontrolledFixtures = new Set(this.stage.fixtures.values());
        const graphs = currentActiveItems.filter((i) => isGraphLibraryItem(i.libraryItem));
        for (const g of graphs) {
            try {
                const relativeTrackItemProgress = (unit - g.start) / (g.end - g.start);
                const results = await this.processGraph(g, unit, { ...calculationData, relativeTrackItemProgress });
                if (g.libraryItem.error) {
                    g.libraryItem.error = "";
                }
                this.applyGraphResults(results, uncontrolledFixtures);
            } catch (err) {
                console.error(err);
                g.libraryItem.error = String(err);
            }
        }

        for (const fixture of uncontrolledFixtures) {
            fixture.resetValue();
        }

        const scripts = currentActiveItems.filter((i) => isScriptLibraryItem(i.libraryItem));
        for (const s of scripts) {
            const script = s.libraryItem as ScriptLibraryItem;
            try {
                await script.run({
                    ...calculationData,
                    relativeTrackItemProgress: (unit - s.start) / (s.end - s.start),
                });
            } catch (err) {
                console.error(err);
                script.error = String(err);
            }
        }
    }

    protected async activate(item: Item) {
        const libraryItem = item.libraryItem;
        if (isScriptLibraryItem(libraryItem)) {
            await libraryItem.activate();
        }
    }

    protected async deactivate(item: Item) {
        const libraryItem = item.libraryItem;
        if (isScriptLibraryItem(libraryItem)) {
            await libraryItem.activate();
        }
    }

    private getAudioData(audioItem: AudioLibraryItem, startUnit: number, currentUnit: number): AudioData | null {
        if (!audioItem.audioBuffer) {
            return null;
        }

        const offsetInSeconds = unitToSeconds(currentUnit - startUnit, this.globalState.bpm);
        const offsetInSamples = Math.floor(offsetInSeconds * audioItem.audioBuffer.sampleRate);
        const data = audioItem.audioBuffer.getChannelData(0);
        const samples = data.slice(offsetInSamples, Math.min(offsetInSamples + FFT_SIZE, data.length));
        const windowedSamples = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            windowedSamples[i] = samples[i] * this.fftWindow[i];
        }

        const fftOutput = this.fft.createComplexArray();
        this.fft.realTransform(fftOutput, windowedSamples);
        const frequencyData = new Float32Array(fftOutput.length / 2);
        for (let i = 0; i < fftOutput.length; i += 2) {
            const real = fftOutput[i];
            const imag = fftOutput[i + 1];
            frequencyData[i / 2] = 20 * Math.log10(Math.sqrt(real * real + imag * imag) / FFT_SIZE);
        }

        return {
            timeDomainData: samples,
            frequencyData,
        };
    }

    private getTrackValues(activeItems: Item[], unit: number) {
        const trackValues = new Map<string, number | INote[]>();
        activeItems
            .filter((i) => isAutomationLibraryItem(i.libraryItem))
            .forEach((i) => {
                const ac = i.libraryItem as AutomationLibraryItem;
                const value = ac.getValueAt(unit - i.start);
                trackValues.set(i.trackId, value);
            });
        activeItems
            .filter((i) => isPatternLibraryItem(i.libraryItem))
            .forEach((i) => {
                const np = i.libraryItem as PatternLibraryItem;
                const notes = np.getNotesAt(unit - i.start);
                trackValues.set(i.trackId, notes);
            });
        return trackValues;
    }

    private async processGraph(item: Item, unit: number, calculationData: ICalculationData): Promise<CalculationResult> {
        const graph = item.libraryItem as GraphLibraryItem;
        graph.keyframeManager.applyKeyframes(unit - item.start);
        const results = (await graph.editor.enginePlugin.runOnce(calculationData))!;
        applyResult(results, graph.editor.editor);
        return results;
    }

    private applyGraphResults(results: CalculationResult, uncontrolledFixtures: Set<BaseFixture>): void {
        for (const nodeResults of results.values()) {
            if (nodeResults.has("_calculationResults")) {
                this.applyGraphResults(nodeResults.get("_calculationResults") as CalculationResult, uncontrolledFixtures);
            } else if (nodeResults.has("fixtureId")) {
                const fixture = this.stage.fixtures.get(nodeResults.get("fixtureId") as string);
                if (fixture) {
                    uncontrolledFixtures.delete(fixture);
                    fixture.setValue(nodeResults.get("data"));
                }
            }
        }
    }

    private getFftWindow(): Float32Array {
        const window = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
        }
        return window;
    }
}
