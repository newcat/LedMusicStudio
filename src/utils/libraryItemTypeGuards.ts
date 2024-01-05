import { LibraryItem, LibraryItemType } from "@/library";
import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { GraphLibraryItem } from "@/graph";
import { PatternLibraryItem } from "@/pattern";

export function isAudioLibraryItem(item: LibraryItem): item is AudioLibraryItem {
    return item.type === LibraryItemType.AUDIO;
}

export function isAutomationLibraryItem(item: LibraryItem): item is AutomationLibraryItem {
    return item.type === LibraryItemType.AUTOMATION;
}

export function isGraphLibraryItem(item: LibraryItem): item is GraphLibraryItem {
    return item.type === LibraryItemType.GRAPH;
}

export function isPatternLibraryItem(item: LibraryItem): item is PatternLibraryItem {
    return item.type === LibraryItemType.PATTERN;
}
