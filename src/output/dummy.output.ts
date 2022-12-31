import { BaseOutput } from "./base.output";
import { OutputType } from "./outputTypes";

export class DummyOutput extends BaseOutput<void, unknown> {
    public type = OutputType.DUMMY;
    public onData(): void {
        // do nothing
    }
    public send(): void {
        // do nothing
    }
    public toObject(): void {}
    public fromObject(state: void): Promise<void> {
        return Promise.resolve();
    }
}
