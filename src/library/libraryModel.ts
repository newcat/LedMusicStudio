import { reactive, Ref, ref } from "vue";
import { serialize, deserialize, Binary } from "bson";
import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { GraphLibraryItem } from "@/graph";
import { BaklavaEvent } from "@baklavajs/events";
import { PatternLibraryItem } from "@/pattern";
import { OutputLibraryItem } from "@/output";
import { LibraryItem, LibraryItemType } from "./libraryItem";

interface ILibraryState {
    items: Array<{
        type: LibraryItemType;
        data: Uint8Array;
    }>;
}

const LOADING_ORDER: LibraryItemType[] = [
    LibraryItemType.AUDIO,
    LibraryItemType.OUTPUT,
    LibraryItemType.AUTOMATION,
    LibraryItemType.PATTERN,
    LibraryItemType.STAGE,
    LibraryItemType.GRAPH,
];

function createItemByType(type: LibraryItemType): LibraryItem | undefined {
    switch (type) {
        case LibraryItemType.AUDIO:
            return new AudioLibraryItem();
        case LibraryItemType.AUTOMATION:
            return new AutomationLibraryItem();
        case LibraryItemType.GRAPH:
            return new GraphLibraryItem();
        case LibraryItemType.PATTERN:
            return new PatternLibraryItem();
        case LibraryItemType.OUTPUT:
            // output will be created during "deserialize"
            return new OutputLibraryItem(undefined as any);
        default:
            console.warn(`Unknown library type: ${type}`);
    }
}

export const useLibrary = defineStore("library", () => {
    const events = {
        loaded: new BaklavaEvent<void, undefined>(undefined),
        itemAdded: new BaklavaEvent<LibraryItem, undefined>(undefined),
        itemRemoved: new BaklavaEvent<LibraryItem, undefined>(undefined),
    };

    const items = ref<LibraryItem[]>([]);
    const selectedItemId = ref<string | null>(null);

    function save() {
        const state: ILibraryState = {
            items: items.value.map((i) => ({
                type: i.type,
                data: i.serialize(),
            })),
        };
        return serialize(state);
    }

    async function load(serialized: Binary) {
        const newItemStates = deserialize(serialized.buffer) as ILibraryState;

        for (const type of LOADING_ORDER) {
            const itemsToLoad = newItemStates.items.filter((i) => i.type === type);
            for (const item of itemsToLoad) {
                const { data } = item;
                const buffer = data.buffer as Buffer;
                let libItem = createItemByType(type);
                if (!libItem) {
                    return;
                }

                libItem = reactive(libItem);
                libItem.deserialize(buffer);
                libItem.load();
                items.value.push(libItem);
            }
        }

        if (items.value.length !== newItemStates.items.length) {
            console.error(`Expected to load ${newItemStates.items.length} items but loaded ${items.value.length} items`);
        }

        events.loaded.emit();
    }

    function getItemById<T extends LibraryItem = LibraryItem>(id: string): T | undefined {
        return items.value.find((i) => i.id === id) as T | undefined;
    }

    function addItem(item: LibraryItem) {
        items.value.push(item);
        events.itemAdded.emit(item);
    }

    function duplicateItem(item: LibraryItem) {
        const duplicate = reactive(createItemByType(item.type)!);
        duplicate.deserialize(item.serialize());
        duplicate.id = uuidv4();
        duplicate.load();
        items.value.push(duplicate);
    }

    async function removeItem(item: LibraryItem) {
        const i = items.value.indexOf(item);
        if (i >= 0) {
            await items.value[i].destroy();
            items.value.splice(i, 1);
            events.itemRemoved.emit(item);
        }
    }

    async function reset() {
        for (const item of items.value.slice()) {
            await removeItem(item);
        }
    }

    return {
        events,
        items: items as Readonly<Ref<ReadonlyArray<LibraryItem>>>,
        selectedItemId,
        save,
        load,
        getItemById,
        addItem,
        duplicateItem,
        removeItem,
        reset,
    };
});
