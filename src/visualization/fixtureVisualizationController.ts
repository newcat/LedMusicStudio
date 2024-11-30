import { BaklavaEvent } from "@baklavajs/events";

import { BaseFixture } from "@/stage/fixtures";
import {
    FixtureVisualization,
    FixtureVisualizationContext,
    FixtureVisualizationUpdateResult,
    VisualizationType,
} from "./fixtureVisualization";

export interface FixtureVisualizationState<C = unknown> {
    type: VisualizationType;
    config: C;
}

export class FixtureVisualizationController<
    Fixture extends BaseFixture = BaseFixture,
    Config = unknown,
    Value = unknown,
    V extends FixtureVisualization<Fixture, Config, Value> = FixtureVisualization<Fixture, Config, Value>
> {
    public readonly events = {
        configChanged: new BaklavaEvent<Config, this>(this),
        valueChanged: new BaklavaEvent<Value, this>(this),
    };

    private _config!: Config;
    private _value!: Value;

    public get config(): Config {
        return this._config;
    }
    public set config(value: Config) {
        this._config = value;
        this.events.configChanged.emit(value);
    }

    public get value(): Value {
        return this._value;
    }
    private set value(value: Value) {
        this._value = value;
        this.events.valueChanged.emit(value);
    }

    public get type() {
        return this.visualization.type;
    }

    public constructor(public readonly visualization: V, public readonly fixture: Fixture) {
        this.config = visualization.defaultConfig(fixture);
        this.updateValue();
        fixture.events.configChanged.subscribe(this, () => this.updateConfig());
        fixture.events.valueChanged.subscribe(this, () => this.updateValue());
    }

    public dispose() {
        this.fixture.events.configChanged.unsubscribe(this);
        this.fixture.events.valueChanged.unsubscribe(this);
    }

    public save(): FixtureVisualizationState<Config> {
        return {
            type: this.visualization.type,
            config: this.config,
        };
    }

    public load(state: FixtureVisualizationState<Config>) {
        this.config = state.config;
    }

    private updateConfig() {
        if (this.visualization.onFixtureConfigUpdate) {
            const result = this.visualization.onFixtureConfigUpdate(this.fixture.config, this.getContext());
            this.applyUpdateResult(result);
        }
    }

    private updateValue() {
        if (this.visualization.onFixtureValueUpdate) {
            const result = this.visualization.onFixtureValueUpdate(this.fixture.value, this.getContext());
            this.applyUpdateResult(result);
        }
    }

    private getContext(): FixtureVisualizationContext<Fixture, Config, Value> {
        return {
            fixture: this.fixture,
            config: this.config,
            value: this.value,
        };
    }

    private applyUpdateResult(result: FixtureVisualizationUpdateResult<Config, Value>) {
        if (result.config) {
            this.config = result.config;
        }
        if (result.value) {
            this.value = result.value;
        }
    }
}
