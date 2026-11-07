import * as THREE from "three";

import { scaleColorArray } from "@/utils/scaleColorArray";
import { Color } from "@/graph/colors";
import type { LedStripSource } from "../../ledLitMaterial";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import type { LedStripVisualizationConfig } from "./types";

const RESOLUTION = 128;
const PROXY_THICKNESS = 0.03;

export class LedStripRenderer extends BaseRenderer<LedStripVisualizationConfig, Color[]> implements LedStripSource {
    private readonly start = new THREE.Vector3(-0.5, 0, 0);
    private readonly end = new THREE.Vector3(0.5, 0, 0);
    private colors: Color[] = [];
    private proxy: THREE.Group | null = null;

    public constructor(inputs: RendererInputs) {
        super(inputs);
        inputs.lighting.addStrip(this);
    }

    public override dispose() {
        this.inputs.lighting.removeStrip(this);
        if (this.proxy) {
            this.proxy.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.geometry.dispose();
                    (o.material as THREE.Material).dispose();
                }
            });
        }
        super.dispose();
    }

    public override onConfigUpdate(config: LedStripVisualizationConfig): void {
        this.start.set(...config.start);
        this.end.set(...config.end);
        this.updateProxy();
    }

    public override onFixtureValueUpdate(data: Color[]): void {
        if (!data || data.length === 0) {
            this.colors = scaleColorArray([[0, 0, 0]], RESOLUTION);
            return;
        }

        this.colors = scaleColorArray(data, RESOLUTION);
    }

    public override createEditorProxy(): THREE.Object3D {
        if (!this.proxy) {
            this.proxy = new THREE.Group();
            const material = new THREE.MeshBasicMaterial({ color: 0xcccccc });
            const strip = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
            strip.name = "strip";
            const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
            arrow.name = "arrow";
            this.proxy.add(strip, arrow);
            this.updateProxy();
        }
        return this.proxy;
    }

    public getLocalStart(): THREE.Vector3 {
        return this.start;
    }

    public getLocalEnd(): THREE.Vector3 {
        return this.end;
    }

    public getColors(): Color[] {
        return this.colors;
    }

    private updateProxy() {
        if (!this.proxy) {
            return;
        }
        const strip = this.proxy.getObjectByName("strip") as THREE.Mesh;
        const arrow = this.proxy.getObjectByName("arrow") as THREE.Mesh;
        const delta = this.end.clone().sub(this.start);
        const length = Math.max(delta.length(), 0.01);
        strip.position.copy(this.start).add(this.end).multiplyScalar(0.5);
        strip.scale.set(PROXY_THICKNESS, PROXY_THICKNESS, length);
        if (delta.lengthSq() > 1e-10) {
            // box length runs along local Z -> align with the strip direction
            strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize());
        }
        // arrow shows the emission direction (local +Y) at the strip center
        arrow.position.copy(strip.position).add(new THREE.Vector3(0, 0.1, 0));
    }
}
