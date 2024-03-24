import FFT from "fft.js";
import { CalculationResult, applyResult } from "baklavajs";

import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { useGlobalState } from "@/globalState";
import { GraphLibraryItem, ICalculationData } from "@/graph";
import { LibraryItemType } from "@/library";
import { INote, PatternLibraryItem } from "@/pattern";
import { BaseFixture, useStage } from "@/stage";
import type { Item } from "@/timeline";
import { unitToSeconds } from "@/utils";

const FFT_SIZE = 8192;
interface AudioData {
    timeDomainData: Float32Array;
    frequencyData: Float32Array;
}

export class BaseTimelineProcessor {
    protected readonly globalState = useGlobalState();
    protected readonly stage = useStage();
    private readonly fft = new FFT(FFT_SIZE);

    private activeItems: Item[] = [];

    public async process(unit: number) {
        const currentActiveItems = this.globalState.timeline.items.filter((i) => i.start <= unit && i.end >= unit) as Item[];

        const newActiveItems = currentActiveItems.filter((i) => !this.activeItems.includes(i));
        newActiveItems.forEach((i) => this.activate(i));

        const newInactiveItems = this.activeItems.filter((i) => !currentActiveItems.includes(i));
        newInactiveItems.forEach((i) => this.deactivate(i));

        this.activeItems = currentActiveItems;

        /** maps trackId -> value */
        const trackValues = this.getTrackValues(currentActiveItems, unit);

        let timeDomainData = new Float32Array(FFT_SIZE);
        let frequencyData = new Float32Array(FFT_SIZE);
        // TODO: handle multiple audio items?
        const audioItem = currentActiveItems.find((i) => this.isType(i, LibraryItemType.AUDIO));
        if (audioItem) {
            const audioData = this.getAudioData(audioItem.libraryItem as AudioLibraryItem, audioItem.start, unit);
            if (audioData) {
                timeDomainData = audioData.timeDomainData;
                frequencyData = audioData.frequencyData;
            }
        }

        const uncontrolledFixtures = new Set(this.stage.fixtures.values()) as Set<BaseFixture>;
        const calculationData: Omit<ICalculationData, "relativeTrackItemProgress"> = {
            resolution: this.globalState.resolution,
            fps: this.globalState.fps,
            position: unit,
            sampleRate: AudioLibraryItem.sampleRate,
            timeDomainData: timeDomainData,
            frequencyData: frequencyData,
            trackValues,
        };
        const graphs = currentActiveItems.filter((i) => this.isType(i, LibraryItemType.GRAPH));
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
    }

    /** @virtual */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected activate(item: Item) {}

    /** @virtual */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected deactivate(item: Item) {}

    private isType(item: Item, type: LibraryItemType): boolean {
        return item.libraryItem.type === type;
    }

    private getAudioData(audioItem: AudioLibraryItem, startUnit: number, currentUnit: number): AudioData | null {
        if (!audioItem.audioBuffer) {
            return null;
        }

        const offsetInSeconds = unitToSeconds(currentUnit - startUnit, this.globalState.bpm);
        const offsetInSamples = offsetInSeconds * audioItem.audioBuffer.sampleRate;
        const data = audioItem.audioBuffer.getChannelData(0);
        const window = data.slice(offsetInSamples, offsetInSamples + FFT_SIZE);
        const fftOutput = this.fft.createComplexArray();
        this.fft.realTransform(fftOutput, window);

        return {
            timeDomainData: window,
            frequencyData: new Float32Array(fftOutput),
        };
    }

    private getTrackValues(activeItems: Item[], unit: number) {
        const trackValues = new Map<string, number | INote[]>();
        activeItems
            .filter((i) => this.isType(i, LibraryItemType.AUTOMATION))
            .forEach((i) => {
                const ac = i.libraryItem as AutomationLibraryItem;
                const value = ac.getValueAt(unit - i.start);
                trackValues.set(i.trackId, value);
            });
        activeItems
            .filter((i) => this.isType(i, LibraryItemType.PATTERN))
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
                    uncontrolledFixtures.delete(fixture as BaseFixture);
                    fixture.setValue(nodeResults.get("data"));
                }
            }
        }
    }
}
