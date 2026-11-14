import { v4 as uuidv4 } from "uuid";
import { PreventableBaklavaEvent, BaklavaEvent } from "@baklavajs/events";
import { LibraryItem, useLibrary } from "@/library";
import { isTarget, type Target } from "@/programming/types";

export interface IItemState {
    id: string;
    start: number;
    end: number;
    trackId: string;
    resizable: boolean;
    libraryItemId: string;
    /** feature 004: target of Look/Effect/Graph items (default null) */
    target?: Target | null;
    /** feature 004: fade lengths in timeline units, ≥ 0 (default 0); used by Look and Effect items */
    fadeIn?: number;
    fadeOut?: number;
}

function fadeOf(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export class Item<L extends LibraryItem = LibraryItem> {
    public static load(state: IItemState): Item {
        const library = useLibrary();
        const libraryItem = library.getItemById(state.libraryItemId || (state as any).data?.libraryItemId)!;
        const i = new Item(libraryItem, state.trackId, state.start, state.end);
        i.id = state.id;
        i.resizable = state.resizable;
        i.target = isTarget(state.target) ? { kind: state.target.kind, id: state.target.id } : null;
        i.fadeIn = fadeOf(state.fadeIn);
        i.fadeOut = fadeOf(state.fadeOut);
        return i;
    }

    public id = uuidv4();
    public trackId: string;
    public selected = false;
    public resizable = true;
    public temporary = false;
    public libraryItem: L;
    /** feature 004 (research R5): group or fixture this item programs; null = none. */
    public target: Target | null = null;
    /** feature 004: fade-in/out in timeline units (Look and Effect items). */
    public fadeIn = 0;
    public fadeOut = 0;

    public events = {
        beforeMoved: new PreventableBaklavaEvent<{ start: number; end: number }, this>(this),
        moved: new BaklavaEvent<{ start: number; end: number }, this>(this),
    };

    private _start: number;
    private _end: number;

    public get start() {
        return this._start;
    }
    public get end() {
        return this._end;
    }

    public constructor(libraryItem: L, trackId: string, start: number, end: number) {
        this.libraryItem = libraryItem;
        this.trackId = trackId;
        this._start = start;
        this._end = end;
    }

    public move(start: number, end: number, force = false) {
        if (!force && this.events.beforeMoved.emit({ start, end }).prevented) {
            return;
        }

        this._start = start;
        this._end = end;
        this.events.moved.emit({ start, end });
    }

    public save(): IItemState {
        return {
            id: this.id,
            start: this.start,
            end: this.end,
            trackId: this.trackId,
            resizable: this.resizable,
            libraryItemId: this.libraryItem.id,
            target: this.target ? { ...this.target } : null,
            fadeIn: this.fadeIn,
            fadeOut: this.fadeOut,
        };
    }
}
