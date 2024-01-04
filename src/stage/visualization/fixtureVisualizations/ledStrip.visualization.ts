import { IWledOutputData } from "@/output";
import { scaleColorArray } from "@/utils";
import * as THREE from "three";
import { LedStripFixture } from "../../fixtures/ledStrip/ledStrip.fixture";
import { BaseVisualization } from "./base.visualization";

export class LedStripVisualization extends BaseVisualization {
    private leds: THREE.PointLight[] = [];

    constructor(private readonly fixture: LedStripFixture, scene: THREE.Scene) {
        super();

        const mesh = scene.children.find((c) => c.uuid === fixture.meshId && c instanceof THREE.Mesh) as THREE.Mesh | undefined;
        if (!mesh) {
            throw new Error(`Mesh with id ${fixture.meshId} not found`);
        }

        mesh.geometry.computeBoundingBox();
        const bb = mesh.geometry.boundingBox!;
        bb.applyMatrix4(mesh.matrix);
        const min = bb.min;
        const max = bb.max;
        for (let i = 0; i < fixture.numLeds; i++) {
            const led = new THREE.PointLight(Math.round(Math.random() * 0xffffff), 0.001, 0);
            const position = min.clone().lerp(max, i / fixture.numLeds);
            led.position.set(position.x, position.y, position.z);
            this.add(led);
            this.leds.push(led);
        }
    }

    public updateData(outputData: Map<string, any>) {
        const data = outputData.get(this.fixture.outputId) as IWledOutputData | undefined;
        if (!data) {
            return;
        }

        const colors = scaleColorArray(data.colors, this.leds.length);
        for (let i = 0; i < this.leds.length; i++) {
            this.leds[i].color.setRGB(colors[i][0], colors[i][1], colors[i][2]);
        }
    }
}
