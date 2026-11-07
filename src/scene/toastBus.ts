/**
 * Tiny event bus so stores (which cannot call `useToast`) can raise toasts. The listener is registered in App.vue.
 */
export interface SceneToast {
    severity: "success" | "info" | "warn" | "error";
    summary: string;
    detail: string;
    life?: number;
}

type Listener = (toast: SceneToast) => void;

const listeners = new Set<Listener>();
/** toasts raised before the first listener existed (e.g. while a project loads at startup) */
const queued: SceneToast[] = [];

export function onSceneToast(listener: Listener): () => void {
    listeners.add(listener);
    for (const toast of queued.splice(0)) {
        listener(toast);
    }
    return () => listeners.delete(listener);
}

export function emitSceneToast(toast: SceneToast) {
    if (listeners.size === 0) {
        queued.push(toast);
        return;
    }
    for (const listener of listeners) {
        listener(toast);
    }
}
