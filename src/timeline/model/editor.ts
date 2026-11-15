import { computed, markRaw, reactive, ref, Ref, watch } from "vue";
import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { BaklavaEvent } from "@baklavajs/events";
import { LibraryItem, LibraryItemType, useLibrary } from "@/library";
import { AudioLibraryItem } from "@/audio";
import { TICKS_PER_BEAT } from "@/constants";
import { useGlobalState } from "@/globalState";
import { Track, ITrackState } from "./track";
import { Item, IItemState, parseClipTarget } from "./item";
import { TimelineHistory, snapshotsEqual, type TimelineSnapshot } from "./history";
import { allowedDelta, type Span } from "./placement";
import { buildEntries, layoutEntries, type ClipboardEntry } from "./clipboard";

export interface ITimelineState {
    tracks: ITrackState[];
    items: IItemState[];
    unitWidth: number;
    headerWidth: number;
}

export type SelectMode = "replace" | "add" | "toggle";

export const MIN_UNIT_WIDTH = 0.05;
export const MAX_UNIT_WIDTH = 50;

export function clampUnitWidth(v: number): number {
    return Math.min(MAX_UNIT_WIDTH, Math.max(MIN_UNIT_WIDTH, v));
}

/** Clip types that have a target (feature 004). */
export const TARGET_TYPES: readonly LibraryItemType[] = [LibraryItemType.GRAPH, LibraryItemType.LOOK, LibraryItemType.EFFECT];
/** Clip types with fades (spec assumption: not graphs). */
export const FADE_TYPES: readonly LibraryItemType[] = [LibraryItemType.LOOK, LibraryItemType.EFFECT];

/** Library item types "Make unique" can duplicate (scripts have no createItemByType case, audio stays linked). */
export function canMakeUnique(item: Item): boolean {
    const type = item.libraryItem.type;
    return type !== LibraryItemType.AUDIO && type !== LibraryItemType.SCRIPT;
}

export const useTimeline = defineStore("timeline", () => {
    const eventToken = Symbol();
    const globalState = useGlobalState();
    const library = useLibrary();

    const events = {
        itemRemoved: new BaklavaEvent<Item, undefined>(undefined),
    };

    const tracks = ref<Track[]>([]) as Ref<Track[]>;
    const items = ref<Item[]>([]) as Ref<Item[]>;

    const unitWidth = ref(1.5);
    const headerWidth = ref(200);

    // --- view state (feature 005, not saved) -------------------------------------------------------------------------

    const hoveredTrackId = ref<string | null>(null);
    const followPlayhead = ref(false);

    /** Clips per track id, computed once per change (SC-007). */
    const itemsByTrack = computed(() => {
        const map = new Map<string, Item[]>();
        for (const i of items.value) {
            const list = map.get(i.trackId);
            if (list) {
                list.push(i);
            } else {
                map.set(i.trackId, [i]);
            }
        }
        return map;
    });

    function trackIndexOf(trackId: string): number {
        return tracks.value.findIndex((t) => t.id === trackId);
    }

    function spanOf(i: Item, trackDelta = 0): Span {
        return { id: i.id, start: i.start, end: i.end, trackIndex: trackIndexOf(i.trackId) + trackDelta };
    }

    // --- selection (feature 005, research R2) ------------------------------------------------------------------------

    const selectedIds = ref(new Set<string>());
    const anchorId = ref<string | null>(null);

    const selectedItems = computed(() => items.value.filter((i) => selectedIds.value.has(i.id)));

    function isSelected(id: string) {
        return selectedIds.value.has(id);
    }

    function select(ids: readonly string[], mode: SelectMode) {
        const next = mode === "replace" ? new Set<string>() : new Set(selectedIds.value);
        for (const id of ids) {
            if (mode === "toggle" && next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
        }
        selectedIds.value = next;
    }

    /** Selects every clip on the anchor's track whose start lies between anchor and target; another track replaces. */
    function selectRange(toId: string) {
        const anchor = anchorId.value ? items.value.find((i) => i.id === anchorId.value) : undefined;
        const target = items.value.find((i) => i.id === toId);
        if (!target) {
            return;
        }
        if (!anchor || anchor.trackId !== target.trackId) {
            select([toId], "replace");
            anchorId.value = toId;
            return;
        }
        const from = Math.min(anchor.start, target.start);
        const to = Math.max(anchor.start, target.start);
        const ids = (itemsByTrack.value.get(target.trackId) ?? []).filter((i) => i.start >= from && i.start <= to).map((i) => i.id);
        select(ids, "replace");
    }

    function selectAll() {
        select(
            items.value.map((i) => i.id),
            "replace"
        );
    }

    function clearSelection() {
        selectedIds.value = new Set();
        anchorId.value = null;
    }

    function pruneSelection() {
        const existing = new Set(items.value.map((i) => i.id));
        const next = new Set(Array.from(selectedIds.value).filter((id) => existing.has(id)));
        if (next.size !== selectedIds.value.size) {
            selectedIds.value = next;
        }
        if (anchorId.value && !existing.has(anchorId.value)) {
            anchorId.value = null;
        }
    }

    // --- basic content operations ------------------------------------------------------------------------------------

    function reset() {
        items.value.slice().forEach((i) => removeItem(i));
        tracks.value.slice().forEach((t) => removeTrack(t));
        addDefaultTrack();
        history.clear();
        historyVersion.value++;
        clipboard.value = [];
        clearSelection();
    }

    function load(state: ITimelineState) {
        items.value.slice().forEach((i) => removeItem(i));
        tracks.value.slice().forEach((t) => removeTrack(t));
        for (const ts of state.tracks) {
            const t = Track.load(ts);
            addTrack(t);
        }
        state.items.forEach((is) => addItem(Item.load(is)));
        unitWidth.value = state.unitWidth ?? 1.5;
        headerWidth.value = state.headerWidth ?? 200;
        history.clear();
        historyVersion.value++;
        clipboard.value = [];
        clearSelection();
    }

    function save(): ITimelineState {
        return {
            tracks: tracks.value.map((t) => t.save()),
            items: items.value.map((i) => i.save()),
            unitWidth: unitWidth.value,
            headerWidth: headerWidth.value,
        };
    }

    function addTrack(track: Track, index = -1) {
        if (index >= 0) {
            tracks.value.splice(index, 0, track);
        } else {
            tracks.value.push(track);
        }
    }

    function addDefaultTrack() {
        const t = new Track(`Track ${tracks.value.length + 1}`);
        addTrack(t);
        return t;
    }

    function getTrackById(trackId: string) {
        return tracks.value.find((t) => t.id === trackId);
    }

    function removeTrack(track: Track) {
        const i = tracks.value.indexOf(track);
        if (i >= 0) {
            tracks.value.splice(i, 1);
        }
        if (hoveredTrackId.value === track.id) {
            hoveredTrackId.value = null;
        }
    }

    function moveTrack(track: Track, direction: "up" | "down") {
        const i = tracks.value.indexOf(track);
        const other = direction === "up" ? i - 1 : i + 1;
        if (i < 0 || i >= tracks.value.length || other < 0 || other >= tracks.value.length) {
            return;
        }
        const temp = tracks.value[i];
        tracks.value[i] = tracks.value[other];
        tracks.value[other] = temp;
    }

    function addItem(item: Item) {
        items.value.push(item);
    }

    function removeItem(item: Item) {
        const i = items.value.indexOf(item);
        if (i >= 0) {
            items.value.splice(i, 1);
            if (selectedIds.value.has(item.id)) {
                const next = new Set(selectedIds.value);
                next.delete(item.id);
                selectedIds.value = next;
            }
            if (anchorId.value === item.id) {
                anchorId.value = null;
            }
            events.itemRemoved.emit(item);
        }
    }

    function getPositionRelativeToItem(item: LibraryItem): number {
        const unit = globalState.position;
        const currentActiveItems = items.value.filter((i) => i.start <= unit && i.end >= unit);
        const activeItemOfType = currentActiveItems.find((i) => i.libraryItem.id === item.id);
        return activeItemOfType ? unit - activeItemOfType.start : -1;
    }

    function audioLength(libraryItem: LibraryItem, bpm: number): number | null {
        if (libraryItem.type !== LibraryItemType.AUDIO) {
            return null;
        }
        const af = libraryItem as AudioLibraryItem;
        return af.audioBuffer ? af.audioBuffer.duration * (bpm / 60) * TICKS_PER_BEAT : null;
    }

    // --- undo history (feature 005, research R1) ---------------------------------------------------------------------

    const history = markRaw(new TimelineHistory());
    const historyVersion = ref(0);
    let editDepth = 0;

    const canUndo = computed(() => historyVersion.value >= 0 && history.canUndo);
    const canRedo = computed(() => historyVersion.value >= 0 && history.canRedo);
    const undoLabel = computed(() => (historyVersion.value >= 0 ? history.topUndoLabel : null));
    const redoLabel = computed(() => (historyVersion.value >= 0 ? history.topRedoLabel : null));

    function snapshot(): TimelineSnapshot {
        return {
            tracks: tracks.value.map((t) => t.save()),
            items: items.value.map((i) => i.save()),
        };
    }

    function record(label: string, before: TimelineSnapshot) {
        if (!snapshotsEqual(before, snapshot())) {
            history.push(label, before);
            historyVersion.value++;
        }
    }

    /** Runs a discrete edit as one undo step (nested edits and edits during a gesture merge into the outer step). */
    function edit<T>(label: string, fn: () => T): T {
        if (editDepth > 0 || history.pending) {
            return fn();
        }
        const before = snapshot();
        editDepth++;
        try {
            return fn();
        } finally {
            editDepth--;
            record(label, before);
        }
    }

    async function editAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        if (editDepth > 0 || history.pending) {
            return fn();
        }
        const before = snapshot();
        editDepth++;
        try {
            return await fn();
        } finally {
            editDepth--;
            record(label, before);
        }
    }

    function beginGesture() {
        if (!history.pending) {
            history.pending = snapshot();
        }
    }

    function endGesture(label: string) {
        const before = history.pending;
        history.pending = null;
        if (before) {
            record(label, before);
        }
    }

    function cancelGesture() {
        const before = history.pending;
        history.pending = null;
        if (before) {
            reconcile(before);
        }
    }

    function reconcile(target: TimelineSnapshot) {
        // tracks: update in place, create missing ones, restore the order
        const trackById = new Map(tracks.value.map((t) => [t.id, t]));
        const nextTracks: Track[] = [];
        for (const ts of target.tracks) {
            const existing = trackById.get(ts.id);
            if (existing) {
                const loaded = Track.load(ts);
                existing.name = loaded.name;
                existing.height = loaded.height;
                existing.removable = loaded.removable;
                existing.data = loaded.data;
                existing.defaultTarget = loaded.defaultTarget;
                nextTracks.push(existing);
            } else {
                nextTracks.push(Track.load(ts));
            }
        }
        tracks.value = nextTracks;

        // items: update by id, create missing ones, drop extra ones
        const itemById = new Map(items.value.map((i) => [i.id, i]));
        const keep = new Set<string>();
        for (const is of target.items) {
            const libraryItem = library.getItemById(is.libraryItemId);
            if (!libraryItem) {
                continue;
            }
            let end = is.end;
            const length = audioLength(libraryItem, globalState.bpm);
            if (length !== null) {
                end = is.start + length;
            }
            keep.add(is.id);
            const existing = itemById.get(is.id);
            if (existing) {
                if (existing.start !== is.start || existing.end !== end) {
                    existing.move(is.start, end, true);
                }
                existing.trackId = is.trackId;
                existing.target = parseClipTarget(is.target);
                existing.fadeIn = is.fadeIn ?? 0;
                existing.fadeOut = is.fadeOut ?? 0;
                existing.resizable = is.resizable;
                existing.libraryItem = libraryItem;
            } else {
                addItem(reactive(Item.load({ ...is, end })) as Item);
            }
        }
        for (const i of items.value.slice()) {
            if (!keep.has(i.id)) {
                removeItem(i);
            }
        }
        pruneSelection();
    }

    function undo() {
        if (history.pending) {
            return;
        }
        const entry = history.popUndo(snapshot());
        if (entry) {
            reconcile(entry.snapshot);
            historyVersion.value++;
        }
    }

    function redo() {
        if (history.pending) {
            return;
        }
        const entry = history.popRedo(snapshot());
        if (entry) {
            reconcile(entry.snapshot);
            historyVersion.value++;
        }
    }

    // --- selection edits ---------------------------------------------------------------------------------------------

    function deleteSelection() {
        edit("Delete", () => {
            selectedItems.value.slice().forEach((i) => removeItem(i));
        });
    }

    // --- clipboard (feature 005, research R10) -----------------------------------------------------------------------

    const clipboard = ref<ClipboardEntry[]>([]);

    function entriesOf(list: readonly Item[]): ClipboardEntry[] {
        return buildEntries(list.map((i) => ({ state: i.save(), trackIndex: trackIndexOf(i.trackId) })));
    }

    function copySelection() {
        if (selectedItems.value.length > 0) {
            clipboard.value = entriesOf(selectedItems.value);
        }
    }

    function cutSelection() {
        if (selectedItems.value.length === 0) {
            return;
        }
        copySelection();
        edit("Cut", () => {
            selectedItems.value.slice().forEach((i) => removeItem(i));
        });
    }

    /** Places copies of `entries` at baseTick/baseTrack, shifted to the nearest free position; selects them. */
    function placeCopies(entries: readonly ClipboardEntry[], baseTick: number, baseTrack: number): Item[] {
        const valid = entries.filter((e) => !!library.getItemById(e.state.libraryItemId));
        if (valid.length === 0) {
            return [];
        }
        const layout = layoutEntries(valid, baseTick, baseTrack);
        const moving: Span[] = layout.map((l, idx) => ({ id: `__new${idx}`, start: l.start, end: l.end, trackIndex: l.trackIndex }));
        const statics = items.value.map((i) => spanOf(i));
        const d = allowedDelta(moving, statics, 0);
        if (d === null) {
            return [];
        }
        const maxTrack = Math.max(...layout.map((l) => l.trackIndex));
        while (tracks.value.length <= maxTrack) {
            addDefaultTrack();
        }
        const created: Item[] = [];
        for (const l of layout) {
            const item = reactive(
                Item.load({ ...l.state, id: uuidv4(), trackId: tracks.value[l.trackIndex].id, start: l.start + d, end: l.end + d })
            ) as Item;
            addItem(item);
            created.push(item);
        }
        select(
            created.map((i) => i.id),
            "replace"
        );
        anchorId.value = created[0]?.id ?? null;
        return created;
    }

    function paste() {
        if (clipboard.value.length === 0) {
            return;
        }
        edit("Paste", () => {
            let baseTrack = hoveredTrackId.value ? trackIndexOf(hoveredTrackId.value) : -1;
            if (baseTrack < 0) {
                const top = clipboard.value.find((e) => e.dTrack === 0);
                baseTrack = top ? trackIndexOf(top.state.trackId) : -1;
            }
            placeCopies(clipboard.value, globalState.position, Math.max(0, baseTrack));
        });
    }

    function duplicateSelection() {
        const list = selectedItems.value;
        if (list.length === 0) {
            return;
        }
        edit("Duplicate", () => {
            const baseTick = Math.max(...list.map((i) => i.end));
            const baseTrack = Math.min(...list.map((i) => trackIndexOf(i.trackId)));
            placeCopies(entriesOf(list), baseTick, Math.max(0, baseTrack));
        });
    }

    /** Clones the selected clips in place (new ids) and selects the clones; used by Alt+drag. */
    function cloneSelectionInPlace(): Item[] {
        const created: Item[] = [];
        for (const i of selectedItems.value) {
            const item = reactive(Item.load({ ...i.save(), id: uuidv4() })) as Item;
            addItem(item);
            created.push(item);
        }
        select(
            created.map((i) => i.id),
            "replace"
        );
        return created;
    }

    /** Gives each group of clips sharing a library item its own copy of that item (FR-017). */
    async function makeUnique(list: readonly Item[]) {
        const groups = new Map<LibraryItem, Item[]>();
        for (const i of list) {
            if (!canMakeUnique(i)) {
                continue;
            }
            const g = groups.get(i.libraryItem);
            if (g) {
                g.push(i);
            } else {
                groups.set(i.libraryItem, [i]);
            }
        }
        if (groups.size === 0) {
            return;
        }
        await editAsync("Make unique", async () => {
            for (const [libraryItem, clips] of groups) {
                const copy = await library.duplicateItem(libraryItem);
                clips.forEach((c) => (c.libraryItem = copy));
            }
        });
    }

    // --- precise editing (feature 005, US7) --------------------------------------------------------------------------

    function nudge(deltaTicks: number) {
        const list = selectedItems.value;
        if (list.length === 0) {
            return;
        }
        edit("Nudge", () => {
            const ids = new Set(list.map((i) => i.id));
            const statics = items.value.filter((i) => !ids.has(i.id)).map((i) => spanOf(i));
            const d = allowedDelta(
                list.map((i) => spanOf(i)),
                statics,
                deltaTicks
            );
            if (d === null || d === 0) {
                return;
            }
            list.forEach((i) => i.move(i.start + d, i.end + d));
        });
    }

    function moveSelectionTracks(dir: -1 | 1) {
        const list = selectedItems.value;
        if (list.length === 0) {
            return;
        }
        const moving = list.map((i) => spanOf(i, dir));
        if (moving.some((m) => m.trackIndex < 0 || m.trackIndex >= tracks.value.length)) {
            return;
        }
        const ids = new Set(list.map((i) => i.id));
        const statics = items.value.filter((i) => !ids.has(i.id)).map((i) => spanOf(i));
        if (allowedDelta(moving, statics, 0) !== 0) {
            return;
        }
        edit("Move to track", () => {
            list.forEach((i, idx) => (i.trackId = tracks.value[moving[idx].trackIndex].id));
        });
    }

    // --- navigation (feature 005, US6) -------------------------------------------------------------------------------

    function zoomToFit(viewWidth: number) {
        const lastEnd = items.value.reduce((p, i) => Math.max(p, i.end), 0);
        unitWidth.value = clampUnitWidth((viewWidth - headerWidth.value - 20) / Math.max(lastEnd, 4 * 4 * TICKS_PER_BEAT));
    }

    watch(
        () => globalState.bpm,
        (newBpm) => {
            // update audio item lengths
            items.value.forEach((i) => {
                const length = audioLength(i.libraryItem, newBpm);
                if (length !== null) {
                    i.move(i.start, i.start + length, true);
                }
            });
        }
    );
    library.events.itemRemoved.subscribe(eventToken, (item) => {
        const itemsToRemove = items.value.filter((i) => i.libraryItem === item);
        for (const i of itemsToRemove) {
            removeItem(i);
        }
    });

    return {
        events,
        tracks: tracks as Readonly<Ref<readonly Track[]>>,
        items: items as Readonly<Ref<readonly Item[]>>,
        unitWidth,
        headerWidth,
        reset,
        load,
        save,
        addTrack,
        addDefaultTrack,
        getTrackById,
        removeTrack,
        moveTrack,
        addItem,
        removeItem,
        getPositionRelativeToItem,
        // feature 005
        itemsByTrack,
        hoveredTrackId,
        followPlayhead,
        selectedIds,
        anchorId,
        selectedItems,
        isSelected,
        select,
        selectRange,
        selectAll,
        clearSelection,
        canUndo,
        canRedo,
        undoLabel,
        redoLabel,
        edit,
        editAsync,
        beginGesture,
        endGesture,
        cancelGesture,
        undo,
        redo,
        deleteSelection,
        clipboard,
        copySelection,
        cutSelection,
        paste,
        duplicateSelection,
        cloneSelectionInPlace,
        makeUnique,
        nudge,
        moveSelectionTracks,
        zoomToFit,
    };
});
