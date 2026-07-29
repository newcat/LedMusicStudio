/**
 * Flow combinators for sequences.
 *
 * The unit of time is one tick, and the protocol is deliberately minimal: a bare `yield` means "this tick is done, resume me on
 * the next one". Everything here composes with `yield*`, so a sequence reads as ordinary control flow while the scheduler stays
 * in charge of when each tick happens.
 *
 * Nothing in this file touches the app — that keeps sequences replayable, which is what makes seeking work.
 */

/** What a combinator produces. */
export type Flow = Generator<unknown, void, unknown>;

/** What a combinator accepts — any generator, including one a script wrote by hand that returns a value. */
export type AnyFlow = Generator<unknown, unknown, unknown>;

/** Do nothing for `ticks` ticks. */
export function* wait(ticks: number): Flow {
    for (let i = 0; i < Math.max(0, Math.floor(ticks)); i++) {
        yield;
    }
}

/**
 * Call `apply` on each of `ticks` ticks, so whatever it writes stays on screen for that long.
 *
 * A frame is built from scratch every tick, so a fixture write only affects the tick it happened on — `set(...)` followed by
 * `wait(n)` is one lit tick and `n` dark ones, not a hold. Anything meant to stay visible has to be written repeatedly, and this
 * is the combinator for the case where it does not change while it does.
 *
 * `hold(0, ...)` writes nothing and takes no time, matching `wait(0)`. That differs from `tween`, where a zero-length tween still
 * applies its end state, because a tween is about arriving somewhere and a hold is about occupying time.
 */
export function* hold(ticks: number, apply: () => void): Flow {
    for (let i = 0; i < Math.max(0, Math.floor(ticks)); i++) {
        apply();
        yield;
    }
}

/** Run every flow in parallel, one step each per tick, until all of them finish. */
export function* all(...flows: AnyFlow[]): Flow {
    const pending = flows.map((flow) => ({ flow, done: false }));
    for (;;) {
        let running = false;
        for (const entry of pending) {
            if (entry.done) {
                continue;
            }
            if (entry.flow.next().done) {
                entry.done = true;
            } else {
                running = true;
            }
        }
        if (!running) {
            return;
        }
        yield;
    }
}

/** Run every flow in parallel until the first one finishes; the rest are abandoned where they stand. */
export function* race(...flows: AnyFlow[]): Flow {
    const pending = [...flows];
    for (;;) {
        let anyStarted = false;
        for (const flow of pending) {
            if (flow.next().done) {
                return;
            }
            anyStarted = true;
        }
        if (!anyStarted) {
            return;
        }
        yield;
    }
}

/** Run `body` once for each index, one after another. */
export function* repeat(count: number, body: (index: number) => AnyFlow): Flow {
    for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
        yield* body(i);
    }
}

/**
 * Run `body` over and over. Ends only when the sequence's timeline item does.
 *
 * An iteration takes exactly as long as its body: a body that yields once runs every tick, not every other one. A body that
 * never yields would spin forever inside a single tick, so that case — and only that case — is forced to consume one.
 */
export function* forever(body: (iteration: number) => AnyFlow): Flow {
    for (let i = 0; ; i++) {
        const flow = body(i);
        let consumedATick = false;
        while (!flow.next().done) {
            consumedATick = true;
            yield;
        }
        if (!consumedATick) {
            yield;
        }
    }
}

export type Easing = (t: number) => number;

export const easing = {
    linear: (t: number) => t,
    easeIn: (t: number) => t * t,
    easeOut: (t: number) => t * (2 - t),
    easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => --t * t * t + 1,
} satisfies Record<string, Easing>;

/**
 * Call `apply` once per tick with eased progress, ending exactly on 1.
 *
 * A zero-length tween applies its end state and consumes no time, so `tween(0, ...)` is a plain assignment rather than a no-op.
 */
export function* tween(ticks: number, apply: (progress: number) => void, ease: Easing = easing.linear): Flow {
    const total = Math.max(0, Math.floor(ticks));
    if (total === 0) {
        apply(1);
        return;
    }
    for (let i = 0; i < total; i++) {
        apply(ease((i + 1) / total));
        yield;
    }
}

/** Linear interpolation between two numbers. */
export function lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
}
