/**
 * Content for the in-app scripting guide.
 *
 * Kept as data rather than markup so that code samples — which are full of angle brackets and braces — are escaped by Vue
 * instead of having to be hand-escaped, and so the guide can be searched and navigated without pulling in a markdown renderer.
 * Inline `backticks` in prose become code spans; see `formatInline` in ScriptingHelp.vue.
 */

export type HelpBlock =
    | { kind: "p"; text: string }
    | { kind: "code"; text: string }
    | { kind: "list"; items: string[] }
    | { kind: "note"; text: string }
    | { kind: "table"; headers: string[]; rows: string[][] };

export interface HelpSection {
    id: string;
    title: string;
    blocks: HelpBlock[];
}

export const HELP_SECTIONS: HelpSection[] = [
    {
        id: "overview",
        title: "Overview",
        blocks: [
            {
                kind: "p",
                text: "A script describes how fixtures behave over time. You write it in TypeScript, place it on a timeline track like any other clip, and it runs for as long as that clip lasts.",
            },
            {
                kind: "p",
                text: "The editor knows your project. `stage` and `tracks` are generated from the fixtures and tracks you actually have, so autocomplete offers real names, and referring to something that has been renamed or deleted is an error while you type rather than a surprise during playback.",
            },
            {
                kind: "p",
                text: "Press **Compile** to load your script into the project. A script that does not type-check will not run — the errors are shown instead.",
            },
        ],
    },
    {
        id: "first-sequence",
        title: "Your first sequence",
        blocks: [
            {
                kind: "p",
                text: "A script exports one sequence. `uses` lists the fixtures it drives, and `run` is a generator function that describes what happens over time.",
            },
            {
                kind: "code",
                text: `export default defineSequence({
  uses: { strip: stage.Ceiling },
  *run(s) {
    s.strip.fill([255, 0, 0]);   // red
    yield* wait(beats(1));       // hold for one beat

    s.strip.fill([0, 0, 255]);   // blue
    yield* wait(beats(1));
  },
});`,
            },
            {
                kind: "p",
                text: "Everything in `uses` becomes available on `s` with the name you gave it, fully typed. Here `s.strip` is the Ceiling fixture.",
            },
            {
                kind: "p",
                text: "When the sequence reaches the end of `run`, it stops and stops writing. Wrap the body in `forever` if you want it to loop for the whole clip.",
            },
        ],
    },
    {
        id: "time",
        title: "Time and ticks",
        blocks: [
            {
                kind: "p",
                text: "Time is counted in **ticks**. There are 24 ticks in a beat. A bare `yield` means *this tick is done, continue on the next one* — that is the whole timing mechanism.",
            },
            {
                kind: "code",
                text: `*run(s) {
  s.strip.fill([255, 0, 0]);
  yield;                    // one tick with the strip red
  s.strip.fill([0, 255, 0]);
  yield;                    // one tick with it green
}`,
            },
            { kind: "p", text: "You rarely count ticks by hand. Use the helpers instead:" },
            {
                kind: "table",
                headers: ["Helper", "Meaning"],
                rows: [
                    ["`beats(2)`", "two beats, in ticks"],
                    ["`bars(4)`", "four bars, in ticks (assumes 4 beats per bar; pass a second argument to change that)"],
                    ["`s.seconds(1.5)`", "1.5 seconds, in ticks at the project tempo"],
                ],
            },
            { kind: "p", text: "And to find out where you are:" },
            {
                kind: "table",
                headers: ["Property", "Meaning"],
                rows: [
                    ["`s.tick`", "ticks since the clip started"],
                    ["`s.elapsedBeats`", "beats since the clip started"],
                    ["`s.progress`", "how far through the clip you are, 0 to 1"],
                ],
            },
            {
                kind: "note",
                text: "`s.elapsedBeats` is a position; `beats(n)` is a conversion. `yield* wait(beats(4))` waits four beats, while `s.elapsedBeats` tells you how many have passed.",
            },
        ],
    },
    {
        id: "fixtures",
        title: "Fixtures",
        blocks: [
            {
                kind: "p",
                text: "Fixtures are reached through `stage`, using the exact name shown in the stage editor. If the name is a plain word you can use a dot; otherwise use brackets.",
            },
            {
                kind: "code",
                text: `stage.Ceiling           // name without spaces
stage["Spot Left"]      // any name at all`,
            },
            {
                kind: "p",
                text: "Declare them in `uses` and reach them through `s` instead. That is what lets the app know which fixtures your script drives without running it — used for layering, for warning you when two scripts fight over a fixture, and for telling you at load time when something it needs is gone.",
            },
            { kind: "p", text: "**LED strips**" },
            {
                kind: "table",
                headers: ["Method", "What it does"],
                rows: [
                    ["`strip.length`", "number of LEDs — known at compile time, so `stage.Ceiling.length` is literally `60`"],
                    ["`strip.set(i, [r, g, b])`", "set one pixel; components are 0–255"],
                    ["`strip.get(i)`", "read a pixel back"],
                    ["`strip.fill([r, g, b])`", "set every pixel"],
                    ["`strip.setAll(colors)`", "set from an array; it is scaled to fit if the lengths differ"],
                    ["`strip.setOpacity(a)`", "how strongly this script covers the strip, 0 to 1 — see Layers"],
                ],
            },
            { kind: "p", text: "**DMX fixtures**" },
            {
                kind: "p",
                text: "Channels are addressed by the names from the fixture definition, not by number, so a typo is caught as you type.",
            },
            {
                kind: "code",
                text: `const spot = stage["Spot Left"];
spot.set("Dimmer", 255);
spot.setChannels({ Red: 120, Blue: 40 });
const level = spot.get("Dimmer");
spot.channels                      // every channel name, in order`,
            },
            {
                kind: "note",
                text: "If a DMX fixture has no definition or mode selected yet it has no channels, and `set` will reject every name. Pick a fixture and mode in the stage editor first.",
            },
        ],
    },
    {
        id: "tracks",
        title: "Reading tracks",
        blocks: [
            {
                kind: "p",
                text: "Automation clips and note patterns on the timeline are readable through `tracks`, again by name. What a track gives you depends on what you put on it.",
            },
            {
                kind: "code",
                text: `const level = tracks["Kick Energy"].value;   // automation: number | undefined
const notes = tracks.Melody.notes;          // patterns: the notes sounding right now

if (level !== undefined) {
  s.strip.fill([level * 255, 0, 0]);
}`,
            },
            {
                kind: "p",
                text: "A track holding only automation clips gives you `.value`; one holding only note patterns gives you `.notes`. A track with a mix of both, or nothing on it yet, gives you `.value` typed as either — check with `Array.isArray` before using it.",
            },
            {
                kind: "p",
                text: "Each note has `value` (pitch), `start`, `end` and `id`. Audio is available too, on `s.data` — `frequencyData` and `timeDomainData` for the current position.",
            },
        ],
    },
    {
        id: "flow",
        title: "Flow",
        blocks: [
            { kind: "p", text: "Flows compose with `yield*`. Each one takes as long as it takes." },
            {
                kind: "table",
                headers: ["Flow", "What it does"],
                rows: [
                    ["`wait(ticks)`", "do nothing for a while"],
                    ["`all(a, b, ...)`", "run several flows at once, finishing when the longest does"],
                    ["`race(a, b, ...)`", "run several at once, finishing when the *first* does"],
                    ["`repeat(n, i => flow)`", "run a flow n times, one after another"],
                    ["`forever(i => flow)`", "run a flow over and over until the clip ends"],
                    ["`tween(ticks, p => ..., ease?)`", "call a function once per tick with progress rising to 1"],
                    ["`s.spawn(flow)`", "let a flow keep running in the background while you carry on"],
                ],
            },
            {
                kind: "code",
                text: `*run(s) {
  // fade the spot up while the strip turns red, then hold
  yield* all(
    tween(beats(0.5), (p) => s.spot.set("Dimmer", p * 255)),
    tween(beats(0.5), (p) => s.strip.fill([p * 255, 0, 0])),
  );
  yield* wait(bars(1));

  // eight chases, one after another
  yield* repeat(8, (i) => chase(s.strip, hsv(i / 8, 1, 1), { step: beats(0.25) }));
}`,
            },
            {
                kind: "p",
                text: "`tween` accepts an easing function: `easing.linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInCubic`, `easeOutCubic`.",
            },
            {
                kind: "note",
                text: "Every loop needs a `yield` somewhere inside it. A loop without one never gives the tick back — scripts are stopped after a million iterations in a single tick with an error saying so.",
            },
        ],
    },
    {
        id: "colour",
        title: "Colour and maths",
        blocks: [
            { kind: "p", text: "A colour is `[red, green, blue]`, each 0–255." },
            {
                kind: "table",
                headers: ["Helper", "What it does"],
                rows: [
                    ["`hsv(h, s, v)`", "build a colour; hue is 0–1 and wraps, so it is easy to drive from a position or a phase"],
                    ["`mix(a, b, f)`", "blend two colours; `f` of 0 gives `a`, 1 gives `b`"],
                    ["`lerp(from, to, t)`", "blend two numbers"],
                ],
            },
            {
                kind: "code",
                text: `// a hue ramp along the strip that drifts over time
for (let i = 0; i < s.strip.length; i++) {
  s.strip.set(i, hsv(i / s.strip.length + s.elapsedBeats * 0.1, 1, 1));
}
yield;`,
            },
        ],
    },
    {
        id: "randomness",
        title: "Randomness",
        blocks: [
            {
                kind: "p",
                text: "Use `s.random()`, `s.randomInt(min, max)` and `s.noise(x, y)` rather than `Math.random()`.",
            },
            {
                kind: "p",
                text: "These are seeded per clip and reset whenever the sequence restarts, so the same tick always produces the same value. That is what makes a generative effect look the same every time you play it back, and what makes a render reproduce exactly. `Math.random()` would give you something different on every pass.",
            },
            {
                kind: "code",
                text: `// a sparkle that is the same on every playthrough
for (let i = 0; i < s.strip.length; i++) {
  if (s.random() < 0.2) {
    s.strip.set(i, [255, 255, 255]);
  }
}
yield;`,
            },
        ],
    },
    {
        id: "layers",
        title: "Layers and blending",
        blocks: [
            {
                kind: "p",
                text: "Scripts and graphs do not overwrite each other. Each clip produces a layer, and layers are composited in track order — the topmost track is drawn last, as in a video editor.",
            },
            {
                kind: "p",
                text: "**Anything you do not touch is transparent, not black.** A script that sets one pixel leaves the rest of the strip showing whatever is on the layers below, so a chase can run over a wash without blacking it out.",
            },
            {
                kind: "code",
                text: `// on a lower track: a red wash across the whole strip
yield* forever(() => (function* () { s.strip.fill([100, 0, 0]); yield; })());

// on a higher track: one blue pixel, with the wash still visible around it
yield* forever(() => (function* () { s.strip.set(1, [0, 0, 255]); yield; })());`,
            },
            {
                kind: "p",
                text: "`strip.setOpacity(a)` dials back how strongly the pixels you *have* written cover what is underneath — which is what fading a whole layer out looks like.",
            },
            {
                kind: "p",
                text: "DMX behaves slightly differently. Channels that mean an amount of something, like a dimmer or a colour, blend normally. Channels that select something — a gobo, a colour wheel slot, a program — cannot be halfway between two settings, so the topmost layer that writes them simply wins.",
            },
        ],
    },
    {
        id: "modules",
        title: "Reusing code",
        blocks: [
            {
                kind: "p",
                text: "Flows are ordinary generator functions, so anything you write once can be shared. Add a **Script Library** item to the library and import it by its name:",
            },
            {
                kind: "code",
                text: `// in a Script Library item called "MyPatterns"
export function* twoStep(strip: LMSLedStrip, color: LMSColor): LMSFlow {
  strip.set(0, color); yield;
  strip.set(3, color); yield;
}`,
            },
            {
                kind: "code",
                text: `// in a script
import { twoStep } from "@lib/MyPatterns";
import { chase } from "@lms/patterns";

export default defineSequence({
  uses: { strip: stage.Ceiling },
  *run(s) {
    yield* twoStep(s.strip, [255, 0, 0]);
    yield* chase(s.strip, [0, 255, 0]);
  },
});`,
            },
            {
                kind: "list",
                items: [
                    "`@lib/<name>` — your own Script Library items, named exactly as they appear in the library",
                    "`@lms/patterns` — the flows that ship with the app",
                ],
            },
            {
                kind: "p",
                text: "The scripting API is available inside library modules too, so they can use `wait`, `beats`, `hsv` and the rest without importing anything.",
            },
            {
                kind: "note",
                text: "Renaming a Script Library item changes its import path, so imports of the old name stop resolving. Update them, or rename it back.",
            },
        ],
    },
    {
        id: "patterns",
        title: "Built-in patterns",
        blocks: [
            { kind: "p", text: "Import these from `@lms/patterns`. All of them take the fixture to act on as the first argument." },
            {
                kind: "table",
                headers: ["Flow", "What it does"],
                rows: [
                    ["`chase(strip, color, { step?, width?, reverse? })`", "light one pixel at a time from one end to the other"],
                    ["`wipe(strip, color, duration?, reverse?)`", "sweep a colour across, leaving it lit behind the front"],
                    ["`rainbow(strip, period?, cycles?)`", "a hue ramp along the strip, cycling over time"],
                    ["`fade(strip, from, to, duration?, ease?)`", "fade the whole strip between two colours"],
                    ["`strobe(strip, color, period?, duty?)`", "flash on and off"],
                    ["`sparkle(strip, color, random, density?, duration?)`", "random pixels each tick — pass `s.random` so it stays reproducible"],
                    ["`euclidean(steps, pulses, step, i => flow)`", "run a flow on the hits of a euclidean rhythm"],
                    ["`euclid(steps, pulses)`", "the rhythm itself, as an array of booleans"],
                ],
            },
            {
                kind: "code",
                text: `import { chase, euclidean } from "@lms/patterns";

// three evenly spread hits over eight sixteenths
yield* euclidean(8, 3, beats(0.25), () => chase(s.strip, [255, 255, 255], { step: 1 }));`,
            },
        ],
    },
    {
        id: "running",
        title: "Running and troubleshooting",
        blocks: [
            {
                kind: "p",
                text: "Press **Compile** to load your script. It runs whenever the playhead is inside its clip on the timeline. Scripts are compiled automatically when a project is opened, so you only need to press Compile after editing.",
            },
            { kind: "p", text: "Things that commonly come up:" },
            {
                kind: "table",
                headers: ["Symptom", "Cause"],
                rows: [
                    [
                        "*Property 'X' does not exist on type ...*",
                        "the fixture or track was renamed or removed. The message lists what does exist.",
                    ],
                    [
                        "*Script exceeded 1,000,000 loop iterations*",
                        "a loop with no `yield` inside it. Every loop that should span time needs one.",
                    ],
                    ["*Cannot find module '@lib/...'*", "the Script Library item was renamed, or the name does not match exactly."],
                    ["Nothing appears", "the clip may not be under the playhead, or a script on a higher track may be covering it."],
                    ["*Declares \"x\" in uses, but that fixture has been removed*", "shown when a project is opened; put the fixture back or update `uses`."],
                ],
            },
            {
                kind: "p",
                text: "Renaming a fixture offers to update the scripts that referred to it. If the new name has spaces or punctuation it cannot be applied automatically to `stage.Name` style references — switch those to `stage[\"Name\"]` first.",
            },
        ],
    },
    {
        id: "seeking",
        title: "Seeking and replay",
        blocks: [
            {
                kind: "p",
                text: "A sequence remembers where it is, so jumping the playhead backwards restarts it and replays it forward to the new position. The catch-up ticks do not draw — only the tick you land on does — so seeking to a given point looks exactly like playing to it.",
            },
            {
                kind: "p",
                text: "One consequence: replayed ticks see the audio and track data of the moment you seeked to, not of the ticks being replayed. A sequence driven by time replays exactly. A sequence that *branches* on audio — say, taking a different path when a beat is loud — may take a different path after a seek.",
            },
        ],
    },
    {
        id: "classic",
        title: "Per-frame scripts",
        blocks: [
            {
                kind: "p",
                text: "If you want a plain per-frame function rather than a sequence, export a class instead. `tick` is called once per tick while the clip is active.",
            },
            {
                kind: "code",
                text: `export default class MyScript implements LMSScript {
  public activate() { /* called when the playhead enters the clip */ }
  public deactivate() { /* called when it leaves */ }

  public tick(data: LMSCalculationData) {
    stage.Ceiling.fill([255, 0, 0]);
  }
}`,
            },
            {
                kind: "p",
                text: "The same thing is expressible as a sequence, and usually reads better: `yield* forever(...)` with your per-tick work inside it, which also gets you `uses`, seeded randomness and seeking.",
            },
        ],
    },
];
