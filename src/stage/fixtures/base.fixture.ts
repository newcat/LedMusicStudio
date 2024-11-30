import { Component } from "vue";
import { v4 as uuidv4 } from "uuid";
import { BaklavaEvent } from "@baklavajs/events";

export enum FixtureType {
    LED_STRIP = "LED Strip",
    DMX = "DMX",
}

export interface FixtureState<V = unknown, C = unknown> {
    id: string;
    type: FixtureType;
    name: string;
    value: V;
    config: C;
}

export abstract class BaseFixture<V = unknown, C = unknown> {
    public id = uuidv4();
    public abstract readonly type: FixtureType;
    public name = "Fixture";
    public readonly settingsComponent: Component | null = null;

    public readonly events = {
        valueChanged: new BaklavaEvent<void, undefined>(undefined),
        configChanged: new BaklavaEvent<void, undefined>(undefined),
    };

    protected _value: V;
    protected _config: C;

    public get value(): V {
        return this._value;
    }

    public get config(): C {
        return this._config;
    }

    public abstract get validationErrors(): string[];

    constructor(initialValue: V, initialConfig: C) {
        this._value = initialValue;
        this._config = initialConfig;
    }

    public setValue(v: V) {
        this._value = v;
        this.events.valueChanged.emit();
    }

    public setConfig(c: C) {
        this._config = c;
        this.events.configChanged.emit();
    }

    public save(): FixtureState<V, C> {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            value: this.value,
            config: this.config,
        };
    }

    public load(state: FixtureState<V, C>) {
        this.id = state.id;
        this.name = state.name;
        this.setValue(state.value);
        this.setConfig(state.config);
    }

    public abstract resetValue(): void;
}
