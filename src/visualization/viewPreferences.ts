import { onScopeDispose, shallowRef, getCurrentScope, type ShallowRef } from "vue";
import type { QualityLevel } from "./quality";

/**
 * View preferences (feature 003, research R12/R16). Stored in localStorage["lms.viewPreferences"] as
 * { v: 1, ...ViewPreferences } and kept in sync across windows (main window and show window) via the
 * `storage` event. No Pinia here: this module is shared by the editor and the show window.
 */

export interface ViewPreferences {
    editor: { quality: QualityLevel; showFps: boolean };
    show: { quality: QualityLevel; showFps: boolean };
    /** FR-061, default true */
    photosensitivityLimit: boolean;
    /** Ignore the limit and show the true strobe rate, default false */
    showTrueStrobeRate: boolean;
}

export interface ViewPreferencesStore {
    get(): ViewPreferences;
    update(patch: Partial<ViewPreferences> | ((p: ViewPreferences) => void)): void;
    subscribe(cb: (p: ViewPreferences) => void): () => void;
}

const STORAGE_KEY = "lms.viewPreferences";
const STORAGE_VERSION = 1;
const QUALITY_LEVELS: readonly QualityLevel[] = ["low", "medium", "high"];

function defaultPreferences(): ViewPreferences {
    return {
        editor: { quality: "medium", showFps: false },
        show: { quality: "medium", showFps: false },
        photosensitivityLimit: true,
        showTrueStrobeRate: false,
    };
}

function isQuality(value: unknown): value is QualityLevel {
    return typeof value === "string" && (QUALITY_LEVELS as readonly string[]).includes(value);
}

function sanitizeView(
    value: unknown,
    fallback: ViewPreferences["editor"],
): ViewPreferences["editor"] {
    if (typeof value !== "object" || value === null) return { ...fallback };
    const v = value as Record<string, unknown>;
    return {
        quality: isQuality(v.quality) ? v.quality : fallback.quality,
        showFps: typeof v.showFps === "boolean" ? v.showFps : fallback.showFps,
    };
}

/** Validates every field; invalid, unknown or missing values fall back to the defaults. */
function sanitize(value: unknown): ViewPreferences {
    const d = defaultPreferences();
    if (typeof value !== "object" || value === null) return d;
    const v = value as Record<string, unknown>;
    return {
        editor: sanitizeView(v.editor, d.editor),
        show: sanitizeView(v.show, d.show),
        photosensitivityLimit:
            typeof v.photosensitivityLimit === "boolean" ? v.photosensitivityLimit : d.photosensitivityLimit,
        showTrueStrobeRate:
            typeof v.showTrueStrobeRate === "boolean" ? v.showTrueStrobeRate : d.showTrueStrobeRate,
    };
}

function clone(p: ViewPreferences): ViewPreferences {
    return {
        editor: { ...p.editor },
        show: { ...p.show },
        photosensitivityLimit: p.photosensitivityLimit,
        showTrueStrobeRate: p.showTrueStrobeRate,
    };
}

function readStorage(): ViewPreferences {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (raw == null) return defaultPreferences();
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return defaultPreferences();
        if ((parsed as { v?: unknown }).v !== STORAGE_VERSION) return defaultPreferences();
        return sanitize(parsed);
    } catch {
        // localStorage unavailable, or corrupt JSON
        return defaultPreferences();
    }
}

function writeStorage(p: ViewPreferences): void {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, ...p }));
    } catch {
        // localStorage unavailable or quota exceeded: keep the in-memory value only
    }
}

function createViewPreferencesStore(): ViewPreferencesStore {
    let current = readStorage();
    const subscribers = new Set<(p: ViewPreferences) => void>();

    const notify = () => {
        for (const cb of [...subscribers]) cb(clone(current));
    };

    if (typeof window !== "undefined") {
        window.addEventListener("storage", (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY && event.key !== null) return;
            // event.key === null means storage was cleared in another window
            const next = event.key === null ? defaultPreferences() : parseStorageValue(event.newValue);
            current = next;
            notify();
        });
    }

    return {
        get(): ViewPreferences {
            return clone(current);
        },
        update(patch): void {
            const next = clone(current);
            if (typeof patch === "function") {
                patch(next);
            } else {
                Object.assign(next, patch);
            }
            current = sanitize(next);
            writeStorage(current);
            notify();
        },
        subscribe(cb): () => void {
            subscribers.add(cb);
            return () => {
                subscribers.delete(cb);
            };
        },
    };
}

/** Parses a raw storage value from a `storage` event (same rules as readStorage). */
function parseStorageValue(raw: string | null): ViewPreferences {
    if (raw == null) return defaultPreferences();
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return defaultPreferences();
        if ((parsed as { v?: unknown }).v !== STORAGE_VERSION) return defaultPreferences();
        return sanitize(parsed);
    } catch {
        return defaultPreferences();
    }
}

/** Singleton store shared by all views in this window. */
export const viewPreferences: ViewPreferencesStore = createViewPreferencesStore();

/** Vue binding: a shallowRef kept in sync with the store. Unsubscribes when the enclosing scope is disposed. */
export function useViewPreferences(): ShallowRef<ViewPreferences> {
    const state = shallowRef<ViewPreferences>(viewPreferences.get());
    const unsubscribe = viewPreferences.subscribe((p) => {
        state.value = p;
    });
    if (getCurrentScope()) {
        onScopeDispose(unsubscribe);
    }
    return state;
}

/** Strobe limit in Hz for the renderers: 3 Hz while the photosensitivity limit is on, null = unlimited. */
export function flashLimitHz(p: ViewPreferences): number | null {
    return p.photosensitivityLimit && !p.showTrueStrobeRate ? 3 : null;
}
