import { markRaw, toRaw } from "vue";

import { BaseFixture, FixtureType, LedStripFixture } from "@/stage/fixtures";
import { BaseVisualization, VisualizationType } from "../base.visualization";
import LedStripVisualizationSettings from "./LedStripVisualizationSettings.vue";
import { LedStripRendererConfig, LedStripVisualizationConfig } from "./types";

export class LedStripVisualization extends BaseVisualization<LedStripFixture, LedStripVisualizationConfig> {
    public static isCompatibleFixture(fixture: BaseFixture): fixture is LedStripFixture {
        return fixture.type === FixtureType.LED_STRIP;
    }

    public readonly compatibleFixtures = [FixtureType.LED_STRIP];
    public readonly type = VisualizationType.LED_STRIP;

    public override readonly settingsComponent = markRaw(LedStripVisualizationSettings);

    constructor(fixture: LedStripFixture) {
        super(fixture, {
            intensity: 0.001,
            start: [0, 0, 0],
            end: [0, 0, 0],
        });
        void this.renderer.createFixtureRenderer(fixture.id, this.type, this.getRendererConfig());
    }

    public setConfig(c: LedStripVisualizationConfig): void {
        super.setConfig(c);
        void this.renderer.onFixtureConfigUpdate(this.fixture.id, this.getRendererConfig());
    }

    public async dispose() {
        await this.renderer.removeFixtureRenderer(this.fixture.id);
        super.dispose();
    }

    protected async onFixtureConfigUpdate() {
        await this.renderer.onFixtureConfigUpdate(this.fixture.id, this.getRendererConfig());
    }

    protected async onFixtureValueUpdate() {
        await this.renderer.onFixtureValueUpdate(this.fixture.id, toRaw(this.fixture.value));
    }

    private getRendererConfig(): LedStripRendererConfig {
        return {
            ...this.config,
            numLeds: this.fixture.config.numLeds,
        };
    }
}
