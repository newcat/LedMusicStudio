import { deserialize, serialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";
import { BaseOutput } from "./base.output";
import { createOutput } from "./outputFactory";
import { OutputType } from "./outputTypes";

export class OutputLibraryItem extends LibraryItem {
    public type = LibraryItemType.OUTPUT;
    public name = "Output";
    public outputInstance!: BaseOutput;

    public constructor(outputType: OutputType | undefined) {
        super();
        if (outputType) {
            this.outputInstance = createOutput(outputType, this.id);
        } else {
            // this happens when loading; deserialize() will be called right after
            // and there the outputInstance will be created.
        }
    }

    public serialize() {
        return serialize({
            id: this.id,
            type: this.outputInstance.type,
            name: this.name,
            state: this.outputInstance.toObject(),
        });
    }

    public async deserialize(buffer: Uint8Array): Promise<void> {
        const { id, type, name, state } = deserialize(buffer);
        this.id = id;
        this.name = name;
        this.outputInstance = createOutput(type, this.id);
        this.outputInstance.fromObject(state);
    }

    public async destroy() {
        await this.outputInstance?.destroy();
    }
}
