import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import { BaseRenderer } from "../base.renderer";
import { getChannelValue } from "../channelValue";
import { GenericVisualizationConfig } from "./types";

/** Output factor, so full output blooms. */
const EMITTER_GAIN = 4;

/**
 * Generic Fixture (feature 002, FR-022, FR-023): the model body plus emitters lit with RGB(W) × intensity.
 * White when no color channel is mapped, full output when no intensity channel is mapped.
 */
export class GenericRenderer extends BaseRenderer<GenericVisualizationConfig, number[]> {
    private config: GenericVisualizationConfig = {
        channelMapping: { intensity: { channel: -1, defaultValue: 1, min: 0, max: 1 }, red: -1, green: -1, blue: -1, white: -1 },
    };
    private values: number[] = [];
    private modelScale = 1;

    public override onModelUpdate(modelId: string, modelScale: number): void {
        this.modelScale = modelScale;
        this.body?.setModelScale(modelScale);
        this.loadBody(modelId);
    }

    public onConfigUpdate(c: GenericVisualizationConfig): void {
        this.config = c;
        this.applyValues();
    }

    public onFixtureValueUpdate(values: number[]): void {
        this.values = values ?? [];
        this.applyValues();
    }

    protected override onBodyReady(body: FixtureBody): void {
        body.setModelScale(this.modelScale);
        this.add(body);
        this.applyValues();
    }

    private applyValues() {
        const body = this.body;
        if (!body) {
            return;
        }
        const mapping = this.config.channelMapping;
        const v = this.values;
        const intensity = getChannelValue(mapping.intensity, v);
        let r = 1;
        let g = 1;
        let b = 1;
        if (mapping.red >= 0 || mapping.green >= 0 || mapping.blue >= 0 || mapping.white >= 0) {
            const white = getChannelValue(mapping.white, v) / 255;
            r = getChannelValue(mapping.red, v) / 255 + white;
            g = getChannelValue(mapping.green, v) / 255 + white;
            b = getChannelValue(mapping.blue, v) / 255 + white;
        }
        const k = intensity * EMITTER_GAIN;
        body.setEmitterColor("all", r * k, g * k, b * k);
    }
}
