import * as THREE from "three";

import type { FixtureBody } from "@/assetLibrary/fixtureBody";
import { emptyMapping } from "../../capabilities/types";
import { BaseRenderer } from "../base.renderer";
import { decodeSimpleColor } from "../interimColor";
import { GenericVisualizationConfig } from "./types";

/** Output factor, so full output blooms. */
const EMITTER_GAIN = 4;

/**
 * Generic Fixture (feature 002, FR-022, FR-023): the model body plus emitters lit with RGB(W) × dimmer, read from
 * `mapping.channels` through `decodeScalar`. White when no color channel is mapped, full output when no dimmer is
 * mapped. Cells and the surface light follow in later phases.
 */
export class GenericRenderer extends BaseRenderer<GenericVisualizationConfig> {
    private config: GenericVisualizationConfig = { mapping: emptyMapping(), surfaceLight: false, lightAngle: 90 };
    private readonly color = new THREE.Color();
    private values: Uint8Array = new Uint8Array(0);
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

    public onFixtureValueUpdate(values: Uint8Array): void {
        this.values = values ?? new Uint8Array(0);
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
        const c = decodeSimpleColor(this.config.mapping ?? emptyMapping(), this.values, this.color);
        const k = EMITTER_GAIN;
        body.setEmitterColor("all", c.r * k, c.g * k, c.b * k);
    }
}
