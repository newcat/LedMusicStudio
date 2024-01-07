import { Component, watch } from "vue";

import type { RemoteStageRenderer } from "../stageRenderer";
import { BaseFixture, FixtureType } from "@/stage/fixtures";
import { useStage } from "@/stage/stage";
import { VisualizationType } from "./types";

export { VisualizationType } from "./types";

export interface VisualizationState<C = unknown> {
    type: VisualizationType;
    config: C;
}

export abstract class BaseVisualization<F extends BaseFixture = BaseFixture, C = unknown> {
    public abstract readonly compatibleFixtures: FixtureType[];
    public abstract readonly type: VisualizationType;

    public readonly settingsComponent: Component | null = null;

    protected _config: C;
    protected readonly renderer: RemoteStageRenderer = useStage().renderer;

    public get config(): C {
        return this._config;
    }

    public constructor(public readonly fixture: F, initialConfig: C) {
        this._config = initialConfig;

        watch(
            () => fixture.config,
            () => this.onFixtureConfigUpdate(),
            { deep: true }
        );
        watch(
            () => fixture.value,
            () => this.onFixtureValueUpdate(),
            { deep: true }
        );
    }

    protected abstract onFixtureConfigUpdate(): void;
    protected abstract onFixtureValueUpdate(): void;

    public dispose() {}

    public setConfig(c: C) {
        this._config = c;
    }

    public save(): VisualizationState<C> {
        return {
            type: this.type,
            config: this.config,
        };
    }

    public load(state: VisualizationState<C>) {
        this.setConfig(state.config);
    }
}
