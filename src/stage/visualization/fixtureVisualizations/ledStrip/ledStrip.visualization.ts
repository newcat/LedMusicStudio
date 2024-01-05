import { markRaw } from "vue";
import * as THREE from "three";

import { scaleColorArray } from "@/utils";
import { BaseFixture, FixtureType } from "@/stage/fixtures";
import { LedStripFixture } from "../../../fixtures/ledStrip/ledStrip.fixture";
import { BaseVisualization, VisualizationType } from "../base.visualization";
import LedStripVisualizationSettings from "./LedStripVisualizationSettings.vue";

export interface LedStripVisualizationConfig {
    intensity: number;
    start: [number, number, number];
    end: [number, number, number];
}

export class LedStripVisualization extends BaseVisualization<LedStripFixture, LedStripVisualizationConfig> {
    public static isCompatibleFixture(fixture: BaseFixture): fixture is LedStripFixture {
        return fixture.type === FixtureType.LED_STRIP;
    }

    public readonly compatibleFixtures = [FixtureType.LED_STRIP];
    public readonly type = VisualizationType.LED_STRIP;

    public override readonly settingsComponent = markRaw(LedStripVisualizationSettings);

    private leds: THREE.PointLight[] = [];

    constructor(fixture: LedStripFixture) {
        super(fixture, {
            intensity: 0.001,
            start: [0, 0, 0],
            end: [0, 0, 0],
        });
        this.generateLeds();
    }

    public setConfig(c: LedStripVisualizationConfig): void {
        super.setConfig(c);
        this.generateLeds();
    }

    public dispose() {
        this.disposeLeds();
        super.dispose();
    }

    protected onFixtureConfigUpdate(): void {
        this.generateLeds();
    }

    protected onFixtureValueUpdate(): void {
        const data = this.fixture.value;
        if (!data || data.length === 0) {
            this.leds.forEach((led) => led.color.setRGB(0, 0, 0));
            return;
        }

        const colors = scaleColorArray(data, this.leds.length);
        for (let i = 0; i < this.leds.length; i++) {
            this.leds[i].color.setRGB(colors[i][0], colors[i][1], colors[i][2]);
        }
    }

    private generateLeds() {
        this.disposeLeds();

        const start = new THREE.Vector3(...this.config.start);
        const end = new THREE.Vector3(...this.config.end);
        const numLeds = this.fixture.config.numLeds;

        for (let i = 0; i < numLeds; i++) {
            const led = new THREE.PointLight(Math.round(Math.random() * 0xffffff), this.config.intensity);
            const position = start.clone().lerp(end, i / numLeds);
            led.position.set(position.x, position.y, position.z);
            this.add(led);
            this.leds.push(led);
        }
        console.log("Generated", this.leds.length, "LEDs");
    }

    private disposeLeds() {
        for (const led of this.leds) {
            this.remove(led);
            led.dispose();
        }
        this.leds = [];
    }
}
