import { v4 as uuidv4 } from "uuid";

export enum LibraryItemType {
    AUDIO = "AUDIO",
    GRAPH = "GRAPH",
    AUTOMATION = "AUTOMATION",
    PATTERN = "PATTERN",
    SCRIPT = "SCRIPT",
    SCRIPT_LIBRARY = "SCRIPT_LIBRARY",
}

export const LibraryItemTypeList = [
    LibraryItemType.AUDIO,
    LibraryItemType.GRAPH,
    LibraryItemType.AUTOMATION,
    LibraryItemType.PATTERN,
    LibraryItemType.SCRIPT,
    LibraryItemType.SCRIPT_LIBRARY,
] as const;

export const LibraryItemTypeLabels: Record<LibraryItemType, string> = {
    [LibraryItemType.AUDIO]: "Audio",
    [LibraryItemType.GRAPH]: "Graph",
    [LibraryItemType.AUTOMATION]: "Automation Clip",
    [LibraryItemType.PATTERN]: "Note Pattern",
    [LibraryItemType.SCRIPT]: "Script",
    [LibraryItemType.SCRIPT_LIBRARY]: "Script Library",
} as const;

export const LibraryItemTypeIcons: Record<LibraryItemType, string> = {
    [LibraryItemType.AUDIO]: "music-box-outline",
    [LibraryItemType.GRAPH]: "graph-outline",
    [LibraryItemType.AUTOMATION]: "chart-bell-curve",
    [LibraryItemType.PATTERN]: "music",
    [LibraryItemType.SCRIPT]: "script-text-outline",
    [LibraryItemType.SCRIPT_LIBRARY]: "library-outline",
} as const;

export abstract class LibraryItem<S = unknown> {
    public id: string = uuidv4();

    public abstract type: LibraryItemType;
    public abstract name: string;

    public loading = false;
    public error = "";

    public abstract save(): S;
    public abstract load(state: S): void | Promise<void>;

    // default implementation does nothing
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async destroy(): Promise<void> {}
}
