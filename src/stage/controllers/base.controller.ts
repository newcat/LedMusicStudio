import { Component } from "vue";
import { v4 as uuidv4 } from "uuid";
import type { BaseFixture, FixtureType } from "../fixtures/base.fixture";

export enum ControllerType {
    WLED = "WLED",
    DMX = "DMX",
    RAZER_CHROMA = "Razer Chroma",
}

export interface ControllerState<C = unknown> {
    id: string;
    type: ControllerType;
    name: string;
    config: C;
    controlledFixtureIds: string[];
}

export abstract class BaseController<C = unknown, F extends BaseFixture = BaseFixture> {
    public id = uuidv4();
    public abstract readonly type: ControllerType;
    public abstract readonly compatibleFixtures: FixtureType[];

    public name: string = "Controller";

    public readonly settingsComponent: Component | null = null;

    protected _config: C;
    protected _controlledFixtures: F[] = [];

    public get config(): C {
        return this._config;
    }

    public get controlledFixtures(): F[] {
        return this._controlledFixtures;
    }

    public abstract get validationErrors(): string[];

    public constructor(initialConfig: C) {
        this._config = initialConfig;
    }

    public setConfig(c: C) {
        this._config = c;
    }

    public addFixture(f: F) {
        this._controlledFixtures.push(f);
    }

    public removeFixture(f: F) {
        this._controlledFixtures = this._controlledFixtures.filter((fixture) => fixture.id !== f.id);
    }

    public save(): ControllerState<C> {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            config: this.config,
            controlledFixtureIds: this.controlledFixtures.map((f) => f.id),
        };
    }

    public load(state: ControllerState<C>, fixtures: Map<string, BaseFixture>) {
        this.id = state.id;
        this.name = state.name;
        this.setConfig(state.config);
        for (const fixtureId of state.controlledFixtureIds) {
            const fixture = fixtures.get(fixtureId);
            if (!fixture) {
                console.warn(`Could not find fixture with id ${fixtureId} for controller ${this.name}`);
                continue;
            }
            this.addFixture(fixture as F);
        }
    }

    public abstract send(): void | Promise<void>;

    /** @virtual */
    public dispose() {}
}
