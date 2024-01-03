import { IWledOutputData, IWledOutputState } from "@/output";
import { scaleColorArray } from "@/utils";
import * as THREE from "three";

export class ThreeLedStrip extends THREE.Group {
    private leds: THREE.PointLight[] = [];

    constructor(private readonly originalMesh: THREE.Mesh, public outputId: string) {
        super();
    }

    public updateState(state: IWledOutputState) {
        this.generateLeds(state.numLeds);
    }

    public updateData(data: IWledOutputData) {
        const colors = scaleColorArray(data.colors, this.leds.length);
        for (let i = 0; i < this.leds.length; i++) {
            this.leds[i].color.setRGB(colors[i][0], colors[i][1], colors[i][2]);
        }
    }

    private generateLeds(ledCount: number) {
        if (this.leds.length > 0) {
            this.remove(...this.leds);
        }

        this.originalMesh.geometry.computeBoundingBox();
        const bb = this.originalMesh.geometry.boundingBox!;
        bb.applyMatrix4(this.originalMesh.matrix);
        const min = bb.min;
        const max = bb.max;
        for (let i = 0; i < ledCount; i++) {
            const led = new THREE.PointLight(Math.round(Math.random() * 0xffffff), 0.001, 0);
            const position = min.clone().lerp(max, i / ledCount);
            led.position.set(position.x, position.y, position.z);
            this.add(led);
            this.leds.push(led);
        }
    }
}
