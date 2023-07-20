import { reactive, Ref, ref } from "vue";
import { serialize, deserialize, Binary } from "bson";
import { defineStore } from "pinia";
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
        const newItems: LibraryItem[] = [];

        for (const item of Object.values(newItemStates.items)) {
            if (!item) {
                break;
            }
            const { type, data } = item;
            const buffer = data.buffer as Buffer;
            let libItem: LibraryItem;
            switch (type) {
                case LibraryItemType.AUDIO:
                    libItem = new AudioLibraryItem();
                    break;
                case LibraryItemType.AUTOMATION:
                    libItem = new AutomationLibraryItem();
                    break;
                case LibraryItemType.GRAPH:
                    libItem = new GraphLibraryItem();
                    break;
                case LibraryItemType.PATTERN:
                    libItem = new PatternLibraryItem();
                    break;
                case LibraryItemType.OUTPUT:
                    // output will be created during "deserialize"
                    libItem = new OutputLibraryItem(undefined as any);
                    break;
                default:
                    console.warn(`Unknown library type: ${type}`);
                    continue;
            }

            libItem = reactive(libItem);
            if (libItem) {
                libItem.deserialize(buffer);
                if ((libItem as any).load) {
                    (libItem as any).load();
                }
                newItems.push(libItem);
            }
        }

        items.value = newItems;
        events.loaded.emit();
    }

    function getItemById<T extends LibraryItem = LibraryItem>(id: string): T | undefined {
        return items.value.find((i) => i.id === id) as T | undefined;
    }

    function addItem(item: LibraryItem) {
        items.value.push(item);
        events.itemAdded.emit(item);
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
        removeItem,
        reset,
    };
});
