import FFT from "fft.js";
import { toRaw } from "vue";
import { CalculationResult, applyResult } from "baklavajs";

import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { useGlobalState } from "@/globalState";
import { GraphLibraryItem, ICalculationData } from "@/graph";
import { INote, PatternLibraryItem } from "@/pattern";
import { BaseFixture, FixtureType, useStage } from "@/stage";
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
import { attributeOutputTarget, processProgramming, type GraphRun } from "@/programming/processor";
import { resolveTarget } from "@/programming/targets";
import { programmingTimings } from "@/programming/debug";
import type { AttributeValues } from "@/programming/attributes";
import type { ResolvedFixture } from "@/programming/types";

const FIXTURE_INPUT_NODE = "Fixture Input";
const ATTRIBUTE_OUTPUT_NODE = "Attribute Output";
const COMMON_TARGET_ERROR = "Per-fixture graphs need one common target";

/** Outputs of one graph evaluation, split by destination. */
interface CollectedOutputs {
    run: GraphRun;
    /** Non-DMX fixtures (LED strips, …) keep the old whole-fixture path (FR-015). */
    direct: Array<{ fixture: BaseFixture; data: unknown }>;
}

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

        // feature 004: graph outputs are collected; DMX fixtures get the merged frame of the programming engine,
        // other fixtures keep the whole-fixture path (last writer wins, reset when uncontrolled)
        const graphRuns = new Map<Item, GraphRun[]>();
        const uncontrolledFixtures = new Set(Array.from(this.stage.fixtures.values()).filter((f) => f.type !== FixtureType.DMX));
        const graphsStarted = performance.now();
        programmingTimings.graphRuns = 0;
        const graphs = currentActiveItems.filter((i) => isGraphLibraryItem(i.libraryItem));
        for (const g of graphs) {
            try {
                const relativeTrackItemProgress = (unit - g.start) / (g.end - g.start);
                const outputs = await this.processGraphItem(g, unit, { ...calculationData, relativeTrackItemProgress });
                graphRuns.set(
                    g,
                    outputs.map((o) => o.run)
                );
                // LED strip and other non-DMX outputs: first run only (R7)
                for (const { fixture, data } of outputs[0]?.direct ?? []) {
                    uncontrolledFixtures.delete(fixture);
                    fixture.setValue(data);
                }
            } catch (err) {
                console.error(err);
                g.libraryItem.error = String(err);
            }
        }
        programmingTimings.graphs = performance.now() - graphsStarted;

        for (const fixture of uncontrolledFixtures) {
            fixture.resetValue();
        }

        processProgramming(currentActiveItems, unit, graphRuns);

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

    /**
     * Evaluates a graph item. Graphs with a Fixture Input node run once per fixture of their Attribute Outputs'
     * common target (R7); all others run once. Errors of a previous frame are cleared on success.
     */
    private async processGraphItem(item: Item, unit: number, calculationData: ICalculationData): Promise<CollectedOutputs[]> {
        const graph = item.libraryItem as GraphLibraryItem;
        graph.keyframeManager.applyKeyframes(unit - item.start);
        const editor = graph.editor.editor;
        const nodes = Array.from(editor.graphs).flatMap((g) => g.nodes);

        let fixtures: ResolvedFixture[] | null = null;
        if (nodes.some((n) => n.type === FIXTURE_INPUT_NODE)) {
            const lists = nodes
                .filter((n) => n.type === ATTRIBUTE_OUTPUT_NODE)
                .map((n) => resolveTarget(attributeOutputTarget(item, String((n.inputs as Record<string, { value: unknown }>).target?.value ?? "clip"))).fixtures);
            const key = (list: ResolvedFixture[]) => list.map((f) => f.fixtureId).join(",");
            if (lists.some((list) => key(list) !== key(lists[0]))) {
                graph.error = COMMON_TARGET_ERROR;
                return [];
            }
            fixtures = lists[0] ?? null;
        }

        const outputs: CollectedOutputs[] = [];
        let results: CalculationResult | undefined;
        if (fixtures && fixtures.length > 0) {
            // research R7 / T031: the first run goes through runOnce (events, order refresh); the other fixtures run
            // the graph directly on the raw engine, which skips the run events and Vue proxies (≈4× faster)
            const engine = toRaw(graph.editor.enginePlugin);
            const rawGraph = toRaw(editor.graph);
            for (const f of fixtures) {
                const data: ICalculationData = {
                    ...calculationData,
                    fixture: { index: f.index, normalizedIndex: f.normalizedIndex, position: f.position, groupSize: fixtures.length, fixtureId: f.fixtureId },
                };
                results =
                    f === fixtures[0]
                        ? (await graph.editor.enginePlugin.runOnce(data))!
                        : await engine.runGraph(rawGraph, engine.getInputValues(rawGraph), data);
                programmingTimings.graphRuns++;
                outputs.push(this.collectOutputs(results, f));
            }
        } else {
            results = (await graph.editor.enginePlugin.runOnce(calculationData))!;
            programmingTimings.graphRuns++;
            outputs.push(this.collectOutputs(results, null));
        }
        if (results) {
            applyResult(results, editor);
        }
        if (graph.error) {
            graph.error = "";
        }
        return outputs;
    }

    private collectOutputs(results: CalculationResult, fixture: ResolvedFixture | null): CollectedOutputs {
        const collected: CollectedOutputs = { run: { fixture, raw: [], attributes: [] }, direct: [] };
        const visit = (r: CalculationResult) => {
            for (const nodeResults of r.values()) {
                if (nodeResults.has("_calculationResults")) {
                    visit(nodeResults.get("_calculationResults") as CalculationResult);
                } else if (nodeResults.has("attributeTarget")) {
                    collected.run.attributes.push({
                        target: String(nodeResults.get("attributeTarget") ?? "clip"),
                        attributes: (nodeResults.get("attributes") as AttributeValues) ?? {},
                    });
                } else if (nodeResults.has("fixtureId")) {
                    const fixture = this.stage.fixtures.get(nodeResults.get("fixtureId") as string);
                    if (!fixture) {
                        continue;
                    }
                    if (fixture.type === FixtureType.DMX) {
                        collected.run.raw.push({ fixtureId: fixture.id, data: (nodeResults.get("data") as number[]) ?? [] });
                    } else {
                        collected.direct.push({ fixture, data: nodeResults.get("data") });
                    }
                }
            }
        };
        visit(results);
        return collected;
    }

    private getFftWindow(): Float32Array {
        const window = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
        }
        return window;
    }
}
