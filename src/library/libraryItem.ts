import { v4 as uuidv4 } from "uuid";

export enum LibraryItemType {
    AUDIO = 1,
    GRAPH = 2,
    AUTOMATION = 3,
    PATTERN = 4,
    OUTPUT = 5,
    STAGE = 6,
}

export abstract class LibraryItem {
    public id: string = uuidv4();

    public abstract type: LibraryItemType;
    public abstract name: string;

    public loading = false;
    public error = false;

    public abstract serialize(): Buffer;
    public abstract deserialize(buffer: Buffer): void;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async destroy(): Promise<void> {}
}
