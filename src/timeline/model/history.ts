/**
 * Timeline undo/redo stacks (feature 005, research R1). Store-free: the timeline store passes snapshots in and
 * reconciles itself to the snapshots it gets back.
 */

import type { ITrackState } from "./track";
import type { IItemState } from "./item";

export interface TimelineSnapshot {
    tracks: ITrackState[];
    items: IItemState[];
}

export interface HistoryEntry {
    label: string;
    snapshot: TimelineSnapshot;
}

const LIMIT = 100;

export function snapshotsEqual(a: TimelineSnapshot, b: TimelineSnapshot): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export class TimelineHistory {
    public undoStack: HistoryEntry[] = [];
    public redoStack: HistoryEntry[] = [];
    /** Snapshot taken at the start of an open gesture. */
    public pending: TimelineSnapshot | null = null;

    public get canUndo() {
        return this.undoStack.length > 0;
    }

    public get canRedo() {
        return this.redoStack.length > 0;
    }

    public get topUndoLabel(): string | null {
        return this.undoStack[this.undoStack.length - 1]?.label ?? null;
    }

    public get topRedoLabel(): string | null {
        return this.redoStack[this.redoStack.length - 1]?.label ?? null;
    }

    /** Records the state before an edit. Clears the redo stack. */
    public push(label: string, snapshot: TimelineSnapshot) {
        this.undoStack.push({ label, snapshot });
        if (this.undoStack.length > LIMIT) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    /** Moves `current` to the redo stack and returns the entry to restore, or null. */
    public popUndo(current: TimelineSnapshot): HistoryEntry | null {
        const entry = this.undoStack.pop();
        if (!entry) {
            return null;
        }
        this.redoStack.push({ label: entry.label, snapshot: current });
        return entry;
    }

    /** Moves `current` to the undo stack and returns the entry to restore, or null. */
    public popRedo(current: TimelineSnapshot): HistoryEntry | null {
        const entry = this.redoStack.pop();
        if (!entry) {
            return null;
        }
        this.undoStack.push({ label: entry.label, snapshot: current });
        if (this.undoStack.length > LIMIT) {
            this.undoStack.shift();
        }
        return entry;
    }

    public clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.pending = null;
    }
}
