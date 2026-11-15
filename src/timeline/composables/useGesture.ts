/**
 * Window-level pointer gestures for the timeline (feature 005, research R7/R9/R11): drags keep working when the
 * pointer leaves the panel, Esc cancels, Alt does not focus the Electron menu bar, and the container auto-scrolls
 * when the pointer is near its edge.
 */

export interface GestureOptions {
    onMove(ev: MouseEvent): void;
    onEnd(ev: MouseEvent): void;
    onCancel?(): void;
    /** Scrolls `container` when the pointer is within 40 px of one of its edges. */
    autoScroll?: { container: HTMLElement };
}

export interface Gesture {
    /** The last pointer event of the gesture. */
    readonly lastEvent: MouseEvent | null;
    cancel(): void;
}

const EDGE = 40;
const MAX_SPEED = 20;

function edgeSpeed(pos: number, min: number, max: number): number {
    if (pos < min + EDGE) {
        return -MAX_SPEED * Math.min(1, (min + EDGE - pos) / EDGE);
    }
    if (pos > max - EDGE) {
        return MAX_SPEED * Math.min(1, (pos - (max - EDGE)) / EDGE);
    }
    return 0;
}

export function startGesture(options: GestureOptions, initialEvent?: MouseEvent): Gesture {
    let lastEvent: MouseEvent | null = initialEvent ?? null;
    let frame = 0;
    let done = false;

    const onMouseMove = (ev: MouseEvent) => {
        lastEvent = ev;
        options.onMove(ev);
    };
    const onMouseUp = (ev: MouseEvent) => {
        lastEvent = ev;
        stop();
        options.onEnd(ev);
    };
    const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Alt") {
            ev.preventDefault();
        } else if (ev.type === "keydown" && ev.key === "Escape") {
            ev.preventDefault();
            ev.stopPropagation();
            cancel();
        }
    };

    const tick = () => {
        frame = 0;
        if (done) {
            return;
        }
        const container = options.autoScroll?.container;
        if (container && lastEvent) {
            const r = container.getBoundingClientRect();
            const dx = edgeSpeed(lastEvent.clientX, r.left, r.right);
            const dy = edgeSpeed(lastEvent.clientY, r.top, r.bottom);
            if (dx !== 0 || dy !== 0) {
                const beforeX = container.scrollLeft;
                const beforeY = container.scrollTop;
                container.scrollBy(dx, dy);
                if (container.scrollLeft !== beforeX || container.scrollTop !== beforeY) {
                    options.onMove(lastEvent);
                }
            }
        }
        frame = requestAnimationFrame(tick);
    };

    function stop() {
        done = true;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("keyup", onKey, true);
        if (frame) {
            cancelAnimationFrame(frame);
            frame = 0;
        }
    }

    function cancel() {
        if (done) {
            return;
        }
        stop();
        options.onCancel?.();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    if (options.autoScroll) {
        frame = requestAnimationFrame(tick);
    }

    return {
        get lastEvent() {
            return lastEvent;
        },
        cancel,
    };
}
