import { onBeforeUnmount, onMounted, type Ref } from "vue";

export type ShortcutAction =
    | "moveMode"
    | "rotateMode"
    | "scaleMode"
    | "toggleSpace"
    | "delete"
    | "duplicate"
    | "copy"
    | "paste"
    | "undo"
    | "redo"
    | "selectAll"
    | "focus"
    | "toggleVisibility"
    | "toggleSnap"
    | "viewFront"
    | "viewSide"
    | "viewTop"
    | "viewPerspective"
    | "escape"
    | "rename";

function isTextInput(element: Element | null): boolean {
    if (!element) {
        return false;
    }
    const tag = element.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (element as HTMLElement).isContentEditable;
}

/** Maps a key event to an action (contracts/editor-ui.md -> Keyboard). Cmd replaces Ctrl on macOS. */
export function getShortcutAction(event: KeyboardEvent): ShortcutAction | null {
    const key = event.key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;

    if (mod) {
        if (event.altKey) return null;
        switch (key) {
            case "z":
                return event.shiftKey ? "redo" : "undo";
            case "y":
                return "redo";
            case "d":
                return "duplicate";
            case "c":
                return "copy";
            case "v":
                return "paste";
            case "a":
                return "selectAll";
            default:
                return null;
        }
    }
    if (event.altKey) return null;

    if (event.shiftKey) {
        return key === "s" ? "toggleSnap" : null;
    }
    switch (key) {
        case "w":
            return "moveMode";
        case "e":
            return "rotateMode";
        case "r":
            return "scaleMode";
        case "q":
            return "toggleSpace";
        case "delete":
        case "backspace":
            return "delete";
        case "f":
            return "focus";
        case "h":
            return "toggleVisibility";
        case "1":
            return "viewFront";
        case "3":
            return "viewSide";
        case "7":
            return "viewTop";
        case "5":
            return "viewPerspective";
        case "escape":
            return "escape";
        case "f2":
            return "rename";
        default:
            return null;
    }
}

/**
 * Registers one window keydown listener. Ignores events while a text field, number field, select or
 * contenteditable element has focus (FR-041) and while `isActive` is false.
 */
export function useEditorShortcuts(isActive: Ref<boolean>, handlers: Partial<Record<ShortcutAction, () => void>>) {
    const onKeyDown = (event: KeyboardEvent) => {
        if (!isActive.value || event.defaultPrevented || isTextInput(document.activeElement) || isTextInput(event.target as Element | null)) {
            return;
        }
        const action = getShortcutAction(event);
        const handler = action ? handlers[action] : undefined;
        if (handler) {
            event.preventDefault();
            handler();
        }
    };

    onMounted(() => window.addEventListener("keydown", onKeyDown));
    onBeforeUnmount(() => window.removeEventListener("keydown", onKeyDown));
}
