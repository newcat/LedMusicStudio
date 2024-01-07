import * as THREE from "three";

import { scaleColorArray } from "@/utils/scaleColorArray";
import { Color } from "@/graph/colors";
import { BaseRenderer } from "../base.renderer";
import { LedStripRendererConfig } from "./types";

export class LedStripRenderer extends BaseRenderer<LedStripRendererConfig, Color[]> {
    private leds: THREE.PointLight[] = [];

    public dispose() {
        this.disposeLeds();
        super.dispose();
    }

    public override onConfigUpdate(config: LedStripRendererConfig): void {
        this.disposeLeds();

        const start = new THREE.Vector3(...config.start);
        const end = new THREE.Vector3(...config.end);
        const numLeds = config.numLeds;

        for (let i = 0; i < numLeds; i++) {
            const led = new THREE.PointLight(Math.round(Math.random() * 0xffffff), config.intensity);
            const position = start.clone().lerp(end, i / numLeds);
            led.position.set(position.x, position.y, position.z);
            this.add(led);
            this.leds.push(led);
        }
    }

    public override onFixtureValueUpdate(data: Color[]): void {
        if (!data || data.length === 0) {
            this.leds.forEach((led) => led.color.setRGB(0, 0, 0));
            return;
        }

        const colors = scaleColorArray(data, this.leds.length);
        for (let i = 0; i < this.leds.length; i++) {
            this.leds[i].color.setRGB(colors[i][0], colors[i][1], colors[i][2]);
        }
    }

    private disposeLeds() {
        for (const led of this.leds) {
            this.remove(led);
            led.dispose();
        }
        this.leds = [];
    }
}
