import { OutputType } from "./outputTypes";

export abstract class BaseOutput<S = unknown, D = unknown> {
    public error = "";
    public abstract type: OutputType;

    protected abstract _state: S;

    public get state(): S {
        return this._state;
    }

    public applyState(newState: S): void {
        this._state = newState;
    }

    public abstract onData(data?: D): void | Promise<void>;
    public abstract send(): void | Promise<void>;

    public destroy(): Promise<void> {
        return Promise.resolve();
    }
}
