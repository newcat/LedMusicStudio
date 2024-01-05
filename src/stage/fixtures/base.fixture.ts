import { Component } from "vue";
import { v4 as uuidv4 } from "uuid";
import { BaseVisualization } from "../visualization/fixtureVisualizations/base.visualization";

export enum FixtureType {
    LED_STRIP = "LED Strip",
    DMX = "DMX",
}

export abstract class BaseFixture<V = unknown, C = unknown> {
    public readonly id = uuidv4();
    public abstract readonly type: FixtureType;
    public name: string = "Fixture";
    public readonly settingsComponent: Component | null = null;

    public visualization: BaseVisualization | null = null;

    protected _value: V;
    protected _config: C;

    public get value(): V {
        return this._value;
    }

    public get config(): C {
        return this._config;
    }

    constructor(initialValue: V, initialConfig: C) {
        this._value = initialValue;
        this._config = initialConfig;
    }

    public setValue(v: V) {
        this._value = v;
    }

    public setConfig(c: C) {
        this._config = c;
    }
}
