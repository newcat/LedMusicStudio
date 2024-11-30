import { reactive, Ref, ref } from "vue";
import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { BaklavaEvent } from "@baklavajs/events";
import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { GraphLibraryItem } from "@/graph";
import { PatternLibraryItem } from "@/pattern";
import { LibraryItem, LibraryItemType } from "./libraryItem";

export interface ILibraryState {
    items: {
        id: string;
        type: LibraryItemType;
        name: string;
        state: unknown;
    }[];
}

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

    const loading = ref(false);
    const items = ref<LibraryItem[]>([]);
    const selectedItemId = ref<string | null>(null);

    function save(): ILibraryState {
        return {
            items: items.value.map((i) => ({
                id: i.id,
                type: i.type,
                name: i.name,
                state: i.save(),
            })),
        };
    }

    async function load(state: ILibraryState) {
        loading.value = true;

        for (const item of state.items) {
            let libItem = createItemByType(item.type);
            if (!libItem) {
                console.warn(`Failed to create library item of type ${item.type} with id ${item.id}`);
                continue;
            }

            libItem = reactive(libItem);
            libItem.id = item.id;
            libItem.name = item.name;
            await libItem.load(item.state);
            items.value.push(libItem);
        }

        loading.value = false;
        events.loaded.emit();
    }

    function getItemById<T extends LibraryItem = LibraryItem>(id: string): T | undefined {
        return items.value.find((i) => i.id === id) as T | undefined;
    }

    function addItem(item: LibraryItem) {
        items.value.push(item);
        events.itemAdded.emit(item);
    }

    async function duplicateItem(item: LibraryItem) {
        const duplicate = reactive(createItemByType(item.type)!);
        await duplicate.load(item.save());
        duplicate.id = uuidv4();
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
        loading,
        items: items as Readonly<Ref<readonly LibraryItem[]>>,
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
