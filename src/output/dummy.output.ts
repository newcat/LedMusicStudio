import { BaseOutput } from "./base.output";
import { OutputType } from "./outputTypes";

export class DummyOutput extends BaseOutput<any, any> {
    public type = OutputType.DUMMY;
    protected _state = {};
    public onData(): void {
        // do nothing
    }
    public send(): void {
        // do nothing
    }
}
