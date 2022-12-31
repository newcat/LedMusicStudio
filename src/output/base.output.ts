import { OutputType } from "./outputTypes";

export abstract class BaseOutput<S = unknown, D = unknown> {
    public error = "";
    public abstract type: OutputType;

    public abstract onData(data?: D): void | Promise<void>;
    public abstract send(): void | Promise<void>;

    public abstract toObject(): S;
    public abstract fromObject(state: S): Promise<void>;

    public destroy(): Promise<void> {
        return Promise.resolve();
    }
}
