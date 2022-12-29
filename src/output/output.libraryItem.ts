import { deserialize, serialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";
import { BaseOutput } from "./base.output";
import { createOutput } from "./outputFactory";

export class OutputLibraryItem extends LibraryItem {
    public type = LibraryItemType.OUTPUT;
    public name = "Output";

    public constructor(public outputInstance: BaseOutput<unknown, unknown>) {
        super();
    }

    public serialize(): Buffer {
        return serialize({
            id: this.id,
            type: this.outputInstance.type,
            state: this.outputInstance.state,
        });
    }

    public deserialize(buffer: Buffer): void {
        const { id, type, state } = deserialize(buffer);
        this.id = id;
        this.outputInstance = createOutput(type);
        this.outputInstance.applyState(state);
    }

    public async destroy() {
        await this.outputInstance?.destroy();
    }
}
