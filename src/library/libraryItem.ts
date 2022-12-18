import { v4 as uuidv4 } from "uuid";

export enum LibraryItemType {
    AUDIO = 1,
    GRAPH = 2,
    AUTOMATION = 3,
    PATTERN = 4,
    OUTPUT = 5,
    STAGE = 6,
}

export const LibraryItemTypeList = [
    LibraryItemType.AUDIO,
    LibraryItemType.GRAPH,
    LibraryItemType.AUTOMATION,
    LibraryItemType.PATTERN,
    LibraryItemType.OUTPUT,
    LibraryItemType.STAGE,
] as const;

export const LibraryItemTypeLabels: Record<LibraryItemType, string> = {
    [LibraryItemType.AUDIO]: "Audio",
    [LibraryItemType.GRAPH]: "Graph",
    [LibraryItemType.AUTOMATION]: "Automation Clip",
    [LibraryItemType.PATTERN]: "Note Pattern",
    [LibraryItemType.OUTPUT]: "Output",
    [LibraryItemType.STAGE]: "Stage",
} as const;

export const LibraryItemTypeIcons: Record<LibraryItemType, string> = {
    [LibraryItemType.AUDIO]: "music-box-outline",
    [LibraryItemType.GRAPH]: "graph-outline",
    [LibraryItemType.AUTOMATION]: "chart-bell-curve",
    [LibraryItemType.PATTERN]: "music",
    [LibraryItemType.OUTPUT]: "export",
    [LibraryItemType.STAGE]: "cast-variant",
} as const;

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
