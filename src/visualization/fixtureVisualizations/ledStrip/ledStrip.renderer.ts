import * as THREE from "three";

import { scaleColorArray } from "@/utils/scaleColorArray";
import { Color } from "@/graph/colors";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import type { LedStripVisualizationConfig } from "./types";

const RESOLUTION = 128;

export class LedStripRenderer extends BaseRenderer<LedStripVisualizationConfig, Color[]> {
    private uniform: LedStripUniform = {
        start: new THREE.Vector3(0, 0, 0),
        end: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
    };
    private colors: Color[] = [];

    public constructor(inputs: RendererInputs) {
        super(inputs);
        ledStripInstanceManager.addInstance(this);
    }

    public dispose() {
        ledStripInstanceManager.removeInstance(this);
        super.dispose();
    }

    public override onConfigUpdate(config: LedStripVisualizationConfig): void {
        this.uniform.start = new THREE.Vector3(...config.start);
        this.uniform.end = new THREE.Vector3(...config.end);
        this.uniform.direction = new THREE.Vector3(...config.direction).normalize();
    }

    public override onFixtureValueUpdate(data: Color[]): void {
        if (!data || data.length === 0) {
            this.colors = scaleColorArray([[0, 0, 0]], RESOLUTION);
            return;
        }

        this.colors = scaleColorArray(data, RESOLUTION);
    }

    public getUniform(): LedStripUniform {
        return this.uniform;
    }

    public getColors(): Color[] {
        return this.colors;
    }
}

export interface LedStripUniform {
    start: THREE.Vector3;
    end: THREE.Vector3;
    direction: THREE.Vector3;
}

export interface LedStripUniforms extends Record<string, THREE.IUniform> {
    uNumLedStrips: { value: number };
    uLedStrips: {
        value: LedStripUniform[];
    };
    uLedStripColors: { value: THREE.Texture };
}

export class LedStripInstanceManager {
    public static readonly MAX_INSTANCES = 8;

    private readonly ledStripInstances: LedStripRenderer[] = [];
    private readonly texture: THREE.DataTexture = new THREE.DataTexture(
        new Uint8Array(LedStripInstanceManager.MAX_INSTANCES * 128 * 4), // 128 colors, 4 channels (RGBA)
        128,
        LedStripInstanceManager.MAX_INSTANCES
    );

    public addInstance(instance: LedStripRenderer) {
        this.ledStripInstances.push(instance);
    }

    public removeInstance(instance: LedStripRenderer) {
        const index = this.ledStripInstances.indexOf(instance);
        if (index !== -1) {
            this.ledStripInstances.splice(index, 1);
        }
    }

    public getUniforms(): LedStripUniforms {
        const data = this.texture.image.data as Uint8Array;
        for (let i = 0; i < this.ledStripInstances.length; i++) {
            const colors = this.ledStripInstances[i].getColors();
            for (let ci = 0; ci < 128; ci++) {
                const offset = (i * 128 + ci) * 4;
                data[offset] = colors[ci][0]; // R
                data[offset + 1] = colors[ci][1]; // G
                data[offset + 2] = colors[ci][2]; // B
                data[offset + 3] = 255; // A
            }
        }
        for (let i = this.ledStripInstances.length; i < LedStripInstanceManager.MAX_INSTANCES; i++) {
            const offset = i * 128 * 4;
            for (let ci = 0; ci < 128; ci++) {
                data[offset + ci * 4] = 0; // R
                data[offset + ci * 4 + 1] = 0; // G
                data[offset + ci * 4 + 2] = 0; // B
                data[offset + ci * 4 + 3] = 255; // A
            }
        }
        this.texture.needsUpdate = true;

        const uLedStrips: LedStripUniform[] = new Array(LedStripInstanceManager.MAX_INSTANCES);
        for (let i = 0; i < this.ledStripInstances.length; i++) {
            uLedStrips[i] = this.ledStripInstances[i].getUniform();
        }
        for (let i = this.ledStripInstances.length; i < LedStripInstanceManager.MAX_INSTANCES; i++) {
            uLedStrips[i] = {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(0, 0, 0),
                direction: new THREE.Vector3(1, 0, 0),
            };
        }

        const uniforms: LedStripUniforms = {
            uNumLedStrips: { value: this.ledStripInstances.length },
            uLedStrips: {
                value: uLedStrips,
            },
            uLedStripColors: { value: this.texture },
        };
        return uniforms;
    }
}

export const ledStripInstanceManager = new LedStripInstanceManager();
