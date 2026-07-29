import { LOOP_GUARD_NAME } from "../loopGuard";
import { all, defineSequence, easing, forever, hold, lerp, race, repeat, tween, wait } from "../sequence";
import { bars, beats, hsv, mix } from "./helpers";
import { lmsApi } from "./lms.api";
import { scriptRuntime } from "./runtime";

/**
 * The names a script sees as ambient.
 *
 * These are passed as parameters to the compiled module's wrapper function rather than assigned to `window`. Ambient
 * declarations look identical to a script either way, but parameters cannot be shadowed by anything else on the page — the app
 * already uses `window.stage` for a debug helper — and a script gets no reach into the app beyond what is handed to it here.
 *
 * Every module a script imports is instantiated with the same set, so a shared pattern library can use `wait`, `beats` and the
 * rest without importing anything.
 */
export function createScriptGlobals(): Record<string, unknown> {
    return {
        stage: scriptRuntime.stage,
        tracks: scriptRuntime.tracks,
        lmsApi,
        defineSequence,
        wait,
        hold,
        all,
        race,
        repeat,
        forever,
        tween,
        beats,
        bars,
        lerp,
        easing,
        hsv,
        mix,
        // injected by the loop guard transformer at the top of every loop body
        [LOOP_GUARD_NAME]: () => scriptRuntime.loopBudget.step(),
    };
}
