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
    /** target of Look/Effect/Graph items: a Target, "inherit" (track default, feature 005) or null (none) */
    target?: ClipTarget;
    /** feature 004: fade lengths in timeline units, ≥ 0 (default 0); used by Look and Effect items */
    fadeIn?: number;
    fadeOut?: number;
}

/** Clip target (feature 005, research R3): a group/fixture, "inherit" (the track's defaultTarget, live) or null (none). */
export type ClipTarget = Target | "inherit" | null;

/** Load rule: a valid target is explicit, "inherit" inherits, anything else is none. */
export function parseClipTarget(value: unknown): ClipTarget {
    if (isTarget(value)) {
        return { kind: value.kind, id: value.id };
    }
    return value === "inherit" ? "inherit" : null;
}

export function cloneClipTarget(value: ClipTarget): ClipTarget {
    return value && value !== "inherit" ? { ...value } : value;
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
        i.target = parseClipTarget(state.target);
        i.fadeIn = fadeOf(state.fadeIn);
        i.fadeOut = fadeOf(state.fadeOut);
        return i;
    }

    public id = uuidv4();
    public trackId: string;
    public resizable = true;
    public temporary = false;
    public libraryItem: L;
    /** Group or fixture this item programs, "inherit" for the track's default target, null = none (feature 005, R3). */
    public target: ClipTarget = "inherit";
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
            target: cloneClipTarget(this.target),
            fadeIn: this.fadeIn,
            fadeOut: this.fadeOut,
        };
    }
}
