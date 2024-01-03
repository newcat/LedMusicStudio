import { serialize, deserialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";

export class StageLibraryItem extends LibraryItem {
    public type = LibraryItemType.STAGE;
    public name = "Stage";

    public outputData: Map<string, any> = new Map();

    public serialize() {
        return serialize({
            id: this.id,
            name: this.name,
        });
    }

    public deserialize(buffer: Buffer): void {
        const { id, name } = deserialize(buffer);
        this.id = id;
        this.name = name;
    }

    public onOutputData(outputId: string, data: any) {
        this.outputData.set(outputId, data);
    }
}
