import { Component } from "vue";
import { BaseFixture, FixtureType } from "@/stage";

export enum VisualizationType {
    LED_STRIP = "Led Strip",
    SPOT = "Spot",
    MOVING_HEAD = "Moving Head",
}

export interface FixtureVisualizationContext<Fixture extends BaseFixture, Config, Value> {
    fixture: Fixture;
    config: Config;
    value: Value;
}

export interface FixtureVisualizationUpdateResult<Config, Value> {
    config?: Config;
    value?: Value;
}

export interface FixtureVisualization<Fixture extends BaseFixture = BaseFixture, Config = unknown, Value = unknown> {
    type: VisualizationType;
    compatibleFixtures: FixtureType[];
    defaultConfig: (fixture: Fixture) => Config;
    settingsComponent?: Component;
    onFixtureValueUpdate?: (
        value: Fixture["value"],
        ctx: FixtureVisualizationContext<Fixture, Config, Value>
    ) => FixtureVisualizationUpdateResult<Config, Value>;
    onFixtureConfigUpdate?: (
        config: Fixture["config"],
        ctx: FixtureVisualizationContext<Fixture, Config, Value>
    ) => FixtureVisualizationUpdateResult<Config, Value>;
}
