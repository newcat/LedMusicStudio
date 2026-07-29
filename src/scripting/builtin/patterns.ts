/**
 * Built-in flows, importable from any script as `@lms/patterns`.
 *
 * These are plain generator functions parameterised over a fixture — there is no host magic involved, and anything here could
 * equally live in a script library of your own. That is the point: the pattern vocabulary is a library, not a language.
 *
 * This file is loaded into the script environment as source, so it is written against the ambient scripting API
 * (`wait`, `beats`, `hsv`, ...) rather than importing anything.
 */

/** Light one pixel at a time from one end of the strip to the other. */
export function* chase(strip: LMSLedStrip, color: LMSColor, options: { step?: number; width?: number; reverse?: boolean } = {}): LMSFlow {
    const step = options.step ?? beats(0.25);
    const width = Math.max(1, options.width ?? 1);
    for (let i = 0; i < strip.length; i++) {
        const head = options.reverse ? strip.length - 1 - i : i;
        // held for the whole step, otherwise the head would be lit for one tick and dark for the rest of it
        yield* hold(step, () => {
            for (let w = 0; w < width; w++) {
                const index = options.reverse ? head + w : head - w;
                if (index >= 0 && index < strip.length) {
                    strip.set(index, color);
                }
            }
        });
    }
}

/** Sweep a solid colour across the strip, leaving it lit behind the front. */
export function* wipe(strip: LMSLedStrip, color: LMSColor, duration = beats(1), reverse = false): LMSFlow {
    yield* tween(duration, (progress) => {
        const front = Math.round(progress * strip.length);
        for (let i = 0; i < front; i++) {
            strip.set(reverse ? strip.length - 1 - i : i, color);
        }
    });
}

/** A hue ramp along the strip, cycling over `period`. */
export function* rainbow(strip: LMSLedStrip, period = beats(4), cycles = 1): LMSFlow {
    yield* tween(period, (progress) => {
        for (let i = 0; i < strip.length; i++) {
            strip.set(i, hsv(progress + (i / strip.length) * cycles, 1, 1));
        }
    });
}

/** Fade the whole strip from one colour to another. */
export function* fade(strip: LMSLedStrip, from: LMSColor, to: LMSColor, duration = beats(1), ease?: LMSEasing): LMSFlow {
    yield* tween(duration, (progress) => strip.fill(mix(from, to, progress)), ease);
}

/** Flash on and off. `duty` is the fraction of each period spent lit. */
export function* strobe(strip: LMSLedStrip, color: LMSColor, period = beats(0.25), duty = 0.5): LMSFlow {
    const onTicks = Math.max(1, Math.round(period * duty));
    yield* hold(onTicks, () => strip.fill(color));
    yield* wait(Math.max(0, period - onTicks));
}

/**
 * Random pixels lit each tick.
 *
 * Takes the sequence's own `random` so sparkle stays reproducible across replays and renders — `Math.random` would make every
 * playback differ.
 */
export function* sparkle(strip: LMSLedStrip, color: LMSColor, random: () => number, density = 0.2, duration = beats(1)): LMSFlow {
    for (let t = 0; t < duration; t++) {
        for (let i = 0; i < strip.length; i++) {
            if (random() < density) {
                strip.set(i, color);
            }
        }
        yield;
    }
}

/**
 * Euclidean rhythm: distribute `pulses` as evenly as possible over `steps`.
 *
 * The backbone of a lot of generative rhythm — `euclid(8, 3)` is the tresillo.
 */
export function euclid(steps: number, pulses: number): boolean[] {
    const result: boolean[] = [];
    let bucket = 0;
    for (let i = 0; i < steps; i++) {
        bucket += pulses;
        if (bucket >= steps) {
            bucket -= steps;
            result.push(true);
        } else {
            result.push(false);
        }
    }
    return result;
}

/** Run `body` on the hits of a euclidean rhythm, waiting `step` between every position. */
export function* euclidean(steps: number, pulses: number, step: number, body: (index: number) => LMSFlow): LMSFlow {
    const hits = euclid(steps, pulses);
    for (let i = 0; i < hits.length; i++) {
        if (hits[i]) {
            yield* body(i);
        } else {
            yield* wait(step);
        }
    }
}
