import { Component } from "vue";
import { BaseFixture, FixtureType } from "@/stage/fixtures";

export enum VisualizationType {
    LED_STRIP = "Led Strip",
    SPOT = "Spot",
    MOVING_HEAD = "Moving Head",
    GENERIC = "Generic Fixture",
    LASER = "Laser",
    FLAME = "Flame",
    CO2_JET = "CO2 Jet",
    COLD_SPARK = "Cold Spark",
    FOG = "Fog / Haze",
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
    /** Config of a new visualization; `modelId` is the model of the visualization object (auto-mapping fallbacks). */
    defaultConfig: (fixture: Fixture, modelId?: string) => Config;
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
