import { markRaw, toRaw } from "vue";

import { BaseFixture, DmxFixture, FixtureType } from "@/stage/fixtures";
import { BaseVisualization, VisualizationType } from "../base.visualization";
import SpotVisualizationSettings from "./SpotVisualizationSettings.vue";
import { SpotVisualizationConfig } from "./types";

export class SpotVisualization extends BaseVisualization<DmxFixture, SpotVisualizationConfig> {
    public static isCompatibleFixture(fixture: BaseFixture): fixture is DmxFixture {
        return fixture.type === FixtureType.DMX;
    }

    public readonly compatibleFixtures = [FixtureType.DMX];
    public readonly type = VisualizationType.SPOT;

    public override readonly settingsComponent = markRaw(SpotVisualizationSettings);

    constructor(fixture: DmxFixture) {
        super(fixture, {
            position: [0, 0, 0],
            target: [0, 0, 0],
            colorChannels: [0, 0, 0],
        });
        void this.renderer.createFixtureRenderer(fixture.id, this.type, this.config);
    }

    public setConfig(c: SpotVisualizationConfig): void {
        super.setConfig(c);
        void this.renderer.onFixtureConfigUpdate(this.fixture.id, this.config);
    }

    public async dispose() {
        await this.renderer.removeFixtureRenderer(this.fixture.id);
        super.dispose();
    }

    protected async onFixtureConfigUpdate() {
        await this.renderer.onFixtureConfigUpdate(this.fixture.id, this.config);
    }

    protected async onFixtureValueUpdate() {
        await this.renderer.onFixtureValueUpdate(this.fixture.id, toRaw(this.fixture.value));
    }
}
