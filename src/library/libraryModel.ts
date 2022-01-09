import { LibraryItem, LibraryItemType } from "./libraryItem";
import { serialize, deserialize, Binary } from "bson";
import { AudioLibraryItem } from "@/audio";
import { AutomationLibraryItem } from "@/automation";
import { GraphLibraryItem } from "@/graph";
import { BaklavaEvent } from "@baklavajs/events";
import { PatternLibraryItem } from "@/pattern";
import { OutputLibraryItem } from "@/output";

export class LibraryModel {
    public events = {
        loaded: new BaklavaEvent<void, this>(this),
        itemAdded: new BaklavaEvent<LibraryItem, this>(this),
        itemRemoved: new BaklavaEvent<LibraryItem, this>(this),
    };

    private _items: LibraryItem[] = [];

    public get items() {
        return this._items as ReadonlyArray<LibraryItem>;
    }

    public save(): Buffer {
        return serialize(
            this.items.map((i) => ({
                type: i.type,
                data: i.serialize(),
            }))
        );
    }

    public async load(serialized: Binary) {
        const newItemStates: Record<number, { type: number; data: Buffer }> = deserialize(serialized.buffer);
        const newItems: LibraryItem[] = [];

        for (const item of Object.values(newItemStates)) {
            if (!item) {
                break;
            }
            const { type, data } = item;
            const buffer = data.buffer as Buffer;
            let libItem: LibraryItem | undefined;
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
                    libItem = new OutputLibraryItem();
                    break;
                default:
                    console.warn(`Unknown library type: ${type}`);
            }

            if (libItem) {
                libItem.deserialize(buffer);
                if ((libItem as any).load) {
                    (libItem as any).load();
                }
                newItems.push(libItem);
            }
        }

        for (const item of this._items.slice()) {
            await this.removeItem(item);
        }

        this._items = newItems;
        this.events.loaded.emit();
    }

    public getItemById<T extends LibraryItem = LibraryItem>(id: string): T | undefined {
        return this.items.find((i) => i.id === id) as T | undefined;
    }

    public addItem(item: LibraryItem) {
        this._items.push(item);
        this.events.itemAdded.emit(item);
    }

    public async removeItem(item: LibraryItem) {
        const i = this._items.indexOf(item);
        if (i >= 0) {
            await this._items[i].destroy();
            this._items.splice(i, 1);
            this.events.itemRemoved.emit(item);
        }
    }

    public async destroy() {
        for (const item of this._items.slice()) {
            await this.removeItem(item);
        }
    }
}
