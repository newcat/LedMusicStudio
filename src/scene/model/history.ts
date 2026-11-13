import type { SceneEnvironment, SceneObject, SceneState } from "./types";

export interface HistoryEntry {
    label: string;
    before: Record<string, SceneObject | null>;
    after: Record<string, SceneObject | null>;
    rootOrderBefore: string[];
    rootOrderAfter: string[];
    /** Set only when the command changed the scene environment (feature 003). */
    environmentBefore?: SceneEnvironment;
    environmentAfter?: SceneEnvironment;
    /** Consecutive entries with the same key within `MERGE_WINDOW_MS` are merged into one (live field edits). */
    mergeKey?: string;
    time?: number;
}

export const MERGE_WINDOW_MS = 1000;

export const MAX_HISTORY_ENTRIES = 200;

export class SceneHistory {
    private undoStack: HistoryEntry[] = [];
    private redoStack: HistoryEntry[] = [];

    public get canUndo() {
        return this.undoStack.length > 0;
    }
    public get canRedo() {
        return this.redoStack.length > 0;
    }

    /** Most recent undo entry. */
    public get top(): HistoryEntry | undefined {
        return this.undoStack[this.undoStack.length - 1];
    }

    public push(entry: HistoryEntry) {
        this.undoStack.push(entry);
        if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    /** Returns the entry whose `before` states must be applied. */
    public undo(): HistoryEntry | undefined {
        const entry = this.undoStack.pop();
        if (entry) {
            this.redoStack.push(entry);
        }
        return entry;
    }

    /** Returns the entry whose `after` states must be applied. */
    public redo(): HistoryEntry | undefined {
        const entry = this.redoStack.pop();
        if (entry) {
            this.undoStack.push(entry);
        }
        return entry;
    }

    /** Entry below the most recent one. */
    public get belowTop(): HistoryEntry | undefined {
        return this.undoStack[this.undoStack.length - 2];
    }

    /** Drops the most recent entry without making it redoable (its change is reverted by the caller). */
    public discardTop(): HistoryEntry | undefined {
        return this.undoStack.pop();
    }

    /** Combines the two most recent entries into one with the given label. */
    public mergeTopTwo(label: string) {
        if (this.undoStack.length < 2) {
            return;
        }
        const newer = this.undoStack.pop()!;
        const older = this.undoStack.pop()!;
        const before = { ...older.before };
        for (const [id, state] of Object.entries(newer.before)) {
            if (!(id in before)) {
                before[id] = state;
            }
        }
        this.undoStack.push({
            label,
            before,
            after: { ...older.after, ...newer.after },
            rootOrderBefore: older.rootOrderBefore,
            rootOrderAfter: newer.rootOrderAfter,
            ...(older.environmentBefore || newer.environmentBefore
                ? {
                      environmentBefore: older.environmentBefore ?? newer.environmentBefore,
                      environmentAfter: newer.environmentAfter ?? older.environmentAfter,
                  }
                : {}),
            time: newer.time,
        });
    }

    public clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    /** All object states referenced by the history (used by asset garbage collection). */
    public *allStates(): Iterable<SceneObject> {
        for (const stack of [this.undoStack, this.redoStack]) {
            for (const entry of stack) {
                for (const obj of Object.values(entry.before)) {
                    if (obj) yield obj;
                }
                for (const obj of Object.values(entry.after)) {
                    if (obj) yield obj;
                }
            }
        }
    }
}

export function cloneObject<T extends SceneObject>(obj: T): T {
    return structuredClone(obj);
}

export function cloneStates(states: Record<string, SceneObject | null>): Record<string, SceneObject | null> {
    const result: Record<string, SceneObject | null> = {};
    for (const [id, obj] of Object.entries(states)) {
        result[id] = obj ? cloneObject(obj) : null;
    }
    return result;
}

/**
 * Applies object states to the scene: `null` deletes, otherwise a deep copy is set.
 * Afterwards the `children` arrays of all affected parents are rebuilt and `rootOrder` is set.
 * Parents that are part of `states` keep the child order stored in their state.
 */
export function applyObjectStates(scene: Pick<SceneState, "objects" | "rootOrder">, states: Record<string, SceneObject | null>, rootOrder: string[]) {
    const affectedParents = new Set<string>();
    for (const [id, state] of Object.entries(states)) {
        const existing = scene.objects[id];
        if (existing?.parentId) affectedParents.add(existing.parentId);
        if (state) {
            // plain objects, not Vue proxies, are expected by structuredClone
            scene.objects[id] = cloneObject(state);
            if (state.parentId) affectedParents.add(state.parentId);
        } else {
            Reflect.deleteProperty(scene.objects, id);
        }
    }
    for (const parentId of affectedParents) {
        const parent = scene.objects[parentId];
        if (!parent) {
            continue;
        }
        parent.children = parent.children.filter((c) => scene.objects[c]?.parentId === parentId);
        for (const [id, state] of Object.entries(states)) {
            if (state && state.parentId === parentId && !parent.children.includes(id)) {
                parent.children.push(id);
            }
        }
    }
    for (const [id, state] of Object.entries(states)) {
        const obj = scene.objects[id];
        if (state && obj) {
            obj.children = obj.children.filter((c) => scene.objects[c]?.parentId === id);
        }
    }
    const newRootOrder = rootOrder.filter((id) => scene.objects[id] && scene.objects[id].parentId === null);
    for (const obj of Object.values(scene.objects)) {
        if (obj.parentId === null && !newRootOrder.includes(obj.id)) {
            newRootOrder.push(obj.id);
        }
    }
    scene.rootOrder = newRootOrder;
    return Object.keys(states);
}
