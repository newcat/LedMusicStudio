import { Component, watch } from "vue";
import * as THREE from "three";
import { BaseFixture, FixtureType } from "@/stage/fixtures";

export enum VisualizationType {
    LED_STRIP = "Led Strip",
    SPOT = "Spot",
}

export interface VisualizationState<C = unknown> {
    type: VisualizationType;
    config: C;
}

export abstract class BaseVisualization<F extends BaseFixture = BaseFixture, C = unknown> extends THREE.Group {
    public abstract readonly compatibleFixtures: FixtureType[];
    public abstract readonly type: VisualizationType;

    public readonly settingsComponent: Component | null = null;

    protected _config: C;

    public get config(): C {
        return this._config;
    }

    public constructor(protected readonly fixture: F, initialConfig: C) {
        super();
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
