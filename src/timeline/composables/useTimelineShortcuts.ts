/**
 * Keyboard contract of the timeline (feature 005, research R8, contracts/timeline-ui.md). Ignores keys typed into
 * text inputs and PrimeVue overlays, treats Cmd as Ctrl, and calls preventDefault only for handled keys.
 */

export type ShortcutId =
    | "undo"
    | "redo"
    | "delete"
    | "selectAll"
    | "escape"
    | "copy"
    | "cut"
    | "paste"
    | "duplicate"
    | "nudgeLeft"
    | "nudgeRight"
    | "nudgeLeftBar"
    | "nudgeRightBar"
    | "trackUp"
    | "trackDown"
    | "playPause";

export type ShortcutHandlers = Partial<Record<ShortcutId, (ev: KeyboardEvent) => void>>;

function isTextTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    if (target.matches("input, textarea, select, [contenteditable], [contenteditable] *")) {
        return true;
    }
    return !!target.closest(".p-popover, .p-select-overlay, .p-dialog, .p-contextmenu");
}

function resolve(ev: KeyboardEvent): ShortcutId | null {
    const ctrl = ev.ctrlKey || ev.metaKey;
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (ctrl) {
        switch (key) {
            case "z":
                return ev.shiftKey ? "redo" : "undo";
            case "y":
                return "redo";
            case "a":
                return "selectAll";
            case "c":
                return "copy";
            case "x":
                return "cut";
            case "v":
                return "paste";
            case "d":
                return "duplicate";
        }
        return null;
    }
    if (ev.altKey) {
        return null;
    }
    switch (key) {
        case "Delete":
        case "Backspace":
            return "delete";
        case "Escape":
            return "escape";
        case "ArrowLeft":
            return ev.shiftKey ? "nudgeLeftBar" : "nudgeLeft";
        case "ArrowRight":
            return ev.shiftKey ? "nudgeRightBar" : "nudgeRight";
        case "ArrowUp":
            return "trackUp";
        case "ArrowDown":
            return "trackDown";
        case " ":
            return "playPause";
    }
    return null;
}

/** Returns a keydown handler for the timeline root. */
export function useTimelineShortcuts(handlers: ShortcutHandlers): (ev: KeyboardEvent) => void {
    return (ev: KeyboardEvent) => {
        if (isTextTarget(ev.target)) {
            return;
        }
        const id = resolve(ev);
        const handler = id ? handlers[id] : undefined;
        if (handler) {
            ev.preventDefault();
            handler(ev);
        }
    };
}
