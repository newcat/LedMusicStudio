export function normalizeMouseWheel(ev: WheelEvent) {
    let scrollAmount = ev.deltaY;
    if (ev.deltaMode === 1) {
        scrollAmount *= 32; // Firefox fix, multiplier is trial & error
    }
    return scrollAmount;
}
