import { BaseOutput } from "./base.output";
import { DummyOutput } from "./dummy.output";
import { OutputType } from "./outputTypes";
import { DmxOutput } from "./dmx/dmx.output";
import { WledOutput } from "./wled/wled.output";
import { ChromaOutput } from "./razerchroma/chroma.output";

export function createOutput(type: OutputType): BaseOutput {
    switch (type) {
        case OutputType.DUMMY:
            return new DummyOutput();
        case OutputType.WLED:
            return new WledOutput();
        case OutputType.DMX:
            return new DmxOutput();
        case OutputType.RAZER_CHROMA:
            return new ChromaOutput();
        default:
            throw new Error(`Unknown output type: ${type}`);
    }
}
