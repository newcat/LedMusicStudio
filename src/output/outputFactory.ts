import { BaseOutput } from "./base.output";
import { DummyOutput } from "./dummy.output";
import { OutputType } from "./outputTypes";
import { ChromaOutput } from "./razerchroma/chroma.output";

export function createOutput(type: OutputType, id: string): BaseOutput {
    switch (type) {
        case OutputType.DUMMY:
            return new DummyOutput(id);
        case OutputType.RAZER_CHROMA:
            return new ChromaOutput(id);
        default:
            throw new Error(`Unknown output type: ${type}`);
    }
}
