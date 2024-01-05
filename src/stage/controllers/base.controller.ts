import { Component } from "vue";
import { v4 as uuidv4 } from "uuid";
import type { BaseFixture, FixtureType } from "../fixtures/base.fixture";

export enum ControllerType {
    WLED = "WLED",
    DMX = "DMX",
    RAZER_CHROMA = "Razer Chroma",
}

export abstract class BaseController<C = unknown, F extends BaseFixture = BaseFixture> {
    public readonly id = uuidv4();
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

    public abstract send(): void | Promise<void>;
}
