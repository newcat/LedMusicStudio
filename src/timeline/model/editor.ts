import { ref, Ref, watch } from "vue";
import { defineStore } from "pinia";
import { BaklavaEvent } from "@baklavajs/events";
import { LibraryItem, LibraryItemType, useLibrary } from "@/library";
import { AudioLibraryItem } from "@/audio";
import { TICKS_PER_BEAT } from "@/constants";
import { useGlobalState } from "@/globalState";
import { Track, ITrackState } from "./track";
import { Item, IItemState } from "./item";

export interface ITimelineState {
    tracks: ITrackState[];
    items: IItemState[];
    unitWidth: number;
    headerWidth: number;
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

    function reset() {
        items.value.forEach((i) => removeItem(i));
        tracks.value.forEach((t) => removeTrack(t));
        addDefaultTrack();
    }

    function load(state: ITimelineState) {
        items.value.forEach((i) => removeItem(i));
        tracks.value.forEach((t) => removeTrack(t));
        for (const ts of state.tracks) {
            const t = Track.load(ts);
            addTrack(t);
        }
        state.items.forEach((is) => addItem(Item.load(is)));
        unitWidth.value = state.unitWidth ?? 1.5;
        headerWidth.value = state.headerWidth ?? 200;
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
        if (validateItem()) {
            items.value.push(item);
        }
    }

    function removeItem(item: Item) {
        const i = items.value.indexOf(item);
        if (i >= 0) {
            items.value.splice(i, 1);
            events.itemRemoved.emit(item);
        }
    }

    function validateItem(/*trackId: string, start: number, item: Item*/) {
        /*const isValidItself = item.start < item.end && item.start >= 0 && item.end >= 0;
        return isValidItself && !this.items.some((i) =>
            i.id !== item.id &&
            i.trackId === trackId &&
            ((i.start <= item.start && i.end >= item.start) ||
            (i.start <= item.end && i.end >= item.end) ||
            (i.start >= item.start && i.end <= item.end))
        );*/
        // TODO: Rework
        return true;
    }

    function getPositionRelativeToItem(item: LibraryItem): number {
        const unit = globalState.position;
        const currentActiveItems = items.value.filter((i) => i.start <= unit && i.end >= unit) as Item[];
        const activeItemOfType = currentActiveItems.find((i) => i.libraryItem.id === item.id);
        return activeItemOfType ? unit - activeItemOfType.start : -1;
    }

    watch(
        () => globalState.bpm,
        (newBpm) => {
            // update audio item lengths
            items.value.forEach((i) => {
                if (i.libraryItem.type === LibraryItemType.AUDIO) {
                    const af = i.libraryItem as AudioLibraryItem;
                    if (!af.audioBuffer) {
                        return;
                    }
                    const length = af.audioBuffer.duration * (newBpm / 60) * TICKS_PER_BEAT;
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
        tracks: tracks as Readonly<Ref<ReadonlyArray<Track>>>,
        items: items as Readonly<Ref<ReadonlyArray<Item>>>,
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
    };
});
