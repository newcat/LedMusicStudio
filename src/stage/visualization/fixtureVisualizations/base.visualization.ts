import { Component } from "vue";
import * as THREE from "three";
import { BaseFixture, FixtureType } from "@/stage/fixtures";

export enum VisualizationType {
    LED_STRIP = "Led Strip",
    SPOT = "Spot",
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
    }

    protected abstract onFixtureConfigUpdate(): void;
    protected abstract onFixtureDataUpdate(): void;
    public dispose() {}

    public setConfig(c: C) {
        this._config = c;
    }
}
