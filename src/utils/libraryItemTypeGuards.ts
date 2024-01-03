import { LibraryItem, LibraryItemType } from "@/library";
import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { GraphLibraryItem } from "@/graph";
import { OutputLibraryItem } from "@/output";
import { PatternLibraryItem } from "@/pattern";
import { StageLibraryItem } from "@/stage";

export function isAudioLibraryItem(item: LibraryItem): item is AudioLibraryItem {
    return item.type === LibraryItemType.AUDIO;
}

export function isAutomationLibraryItem(item: LibraryItem): item is AutomationLibraryItem {
    return item.type === LibraryItemType.AUTOMATION;
}

export function isGraphLibraryItem(item: LibraryItem): item is GraphLibraryItem {
    return item.type === LibraryItemType.GRAPH;
}

export function isOutputLibraryItem(item: LibraryItem): item is OutputLibraryItem {
    return item.type === LibraryItemType.OUTPUT;
}

export function isPatternLibraryItem(item: LibraryItem): item is PatternLibraryItem {
    return item.type === LibraryItemType.PATTERN;
}

export function isStageLibraryItem(item: LibraryItem): item is StageLibraryItem {
    return item.type === LibraryItemType.STAGE;
}
