import { serialize, deserialize } from "bson";
import { LibraryItem, LibraryItemType } from "@/library";

export class StageLibraryItem extends LibraryItem {
    public type = LibraryItemType.STAGE;
    public name = "Stage";

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
}
