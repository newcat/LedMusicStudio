import { Component } from "vue";

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

    private _paused = false;

    public get config(): C {
        return this._config;
    }

    protected get paused() {
        return this._paused;
    }

    public constructor(public readonly fixture: F, initialConfig: C) {
        this._config = initialConfig;
        fixture.events.configChanged.subscribe(this, () => this.onFixtureConfigUpdate());
        fixture.events.valueChanged.subscribe(this, () => {
            if (!this._paused) {
                this.onFixtureValueUpdate();
            }
        });
    }

    protected abstract onFixtureConfigUpdate(): void;
    protected abstract onFixtureValueUpdate(): void;

    public dispose() {
        this.fixture.events.configChanged.unsubscribe(this);
        this.fixture.events.valueChanged.unsubscribe(this);
    }

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

    public pause() {
        this._paused = true;
    }

    public resume() {
        this._paused = false;
    }
}
