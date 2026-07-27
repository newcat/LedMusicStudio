# Scripting — Design Document

**Status:** Draft / not yet implemented
**Scope:** Type-safe, environment-aware scripting as a first-class alternative to graphs for driving fixtures.

---

## 1. Motivation

Graphs (BaklavaJS) are good at *continuous, stateless* signal flow: take audio, map it through some math, push colours to a
fixture. They are poor at *sequenced choreography* — "fade the spot in over half a beat, hold for four bars, then run a chase
eight times". Expressing that as a node graph is possible but miserable.

Scripting fills that gap. The requirements are:

1. **Type-safe.** Not "JavaScript in a text box" — real types, real autocomplete, real diagnostics.
2. **Environment-aware.** If a script references a fixture that no longer exists, that must surface while *editing* or at
   *project load*, not as a runtime exception three minutes into a show.
3. **Composable.** Scripts and graphs must coexist on the same fixture in a defined way.
4. **Reusable.** Patterns written once should be importable across scripts and projects.

---

## 2. Current state

### 2.1 The tick loop

Everything is driven by `BaseTimelineProcessor.process(unit)` (`src/timeline/baseTimelineProcessor.ts`), the single entry point,
called from a `setInterval` during playback (`TimelineProcessor`) and in a tight `for` loop by `Renderer.startRender()`
(`src/renderer.ts`). Each tick:

1. Activate/deactivate timeline items crossing the playhead.
2. Gather `trackValues` from automation and pattern items — `Map<string, number | INote[]>`.
3. FFT the current audio window.
4. Run every active **graph**, collect `{ fixtureId, data }` from output nodes, apply via `fixture.setValue(data)`.
5. Call `resetValue()` on every fixture no graph touched (the `uncontrolledFixtures` set).
6. Run every active **script** — `script.run(calculationData)`.

`TICKS_PER_BEAT = 24`.

### 2.2 Fixtures

`BaseFixture<V, C>` (`src/stage/fixtures/base.fixture.ts`) with two implementations:

- `LedStripFixture` — `V = Color[]`, config `{ numLeds }`
- `DmxFixture` — `V = number[]`, channel names derived from the Open Fixture Library definition plus the selected mode
  (`DmxFixture.channelNames`)

### 2.3 The scripting PoC

Further along than "PoC" suggests. `src/scripting/ScriptEditor.vue` runs a **real TypeScript language service in the browser**
via `@typescript/vfs` + `@valtown/codemirror-ts` — autocomplete, hover, diagnostics, all from the same compiler VS Code uses.
`lib.lmsApi.d.ts` is injected as a virtual lib; *Compile* runs `ts.createProgram`, emits UMD, `eval`s it, and instantiates the
default-exported class.

### 2.4 Known gaps

| # | Gap | Location |
|---|---|---|
| 1 | API is stringly-typed and nullable — `findFixtureByName(name): LMSDmxFixture \| null`. No LED strip support. `setValue(channel: number, …)` uses magic indices despite `channelNames` being known. | `src/scripting/api/lms.api.ts` |
| 2 | Scripts bypass arbitration entirely — they run *after* the `resetValue()` loop and poke fixtures imperatively. Graph + script on one fixture is undefined behaviour. | `baseTimelineProcessor.ts:75-107` |
| 3 | Compiled script is not persisted (`save()` stores only source), so scripts are silently dead after a project load until *Compile* is pressed. | `script.libraryItem.ts:21` |
| 4 | Nothing is seekable — a stateful `tick()` yields different output depending on how the playhead arrived. The renderer's linear `0..maxUnit` replay hides this; scrubbing does not. | — |
| 5 | `LibraryItemType.SCRIPT_LIBRARY` is declared in the enum with no implementation. | `src/library/libraryItem.ts` |
| 6 | `ScriptNode` inside graphs is a second, entirely untyped `new Function(code)` scripting surface. | `src/graph/nodes/scriptNode.ts` |
| 7 | `LMSDmxFixtureImpl.setValue` copies the whole value array per channel write; `LedStripFixture.setValue` runs `scaleColorArray` on every call. Per-LED writes are O(n²). | `lms.api.ts:12`, `ledStrip.fixture.ts:25` |
| 8 | The TS environment is constructed per editor instance inside `onMounted`, so there is no cross-script program. | `ScriptEditor.vue:39` |

---

## 3. Prior art

**[Motion Canvas](https://motioncanvas.io/docs/flow/)** — generator functions with `yield*` as the animation primitive, plus
signals for animatable properties. Crucially, it makes *stateful* generator code seekable by **replaying the scene from its
start** to the target frame. Directly applicable: our timeline items have a `start`, so replay is bounded and cheap.

**[Strudel](https://strudel.cc/technical-manual/repl/)** — a TidalCycles port to JS. The mini-notation parser (peggy) is sugar;
the substance is the **pattern algebra** — patterns as pure functions from time-span to events, composed with combinators. That
algebra is just a library, and in TypeScript it is a fully-typed one. Also worth stealing: the REPL highlights which code
element produced the currently-playing event.

**[Sonic Pi](https://sonic-pi.net/tutorial.html)** — deterministic randomness (same seed every run, so generative output
reproduces across renders), `live_loop` hot-swap at cycle boundaries, and logical time (`sleep` in beats) decoupled from wall
time. The last maps exactly onto our `unit` / `TICKS_PER_BEAT` model.

**[Pixelblaze](https://github.com/simap/pixelblaze/blob/v3/README.expressions.md)** — the closest prior art in this exact domain
(WiFi LED controller, JS-subset language, live editor, compiles on every keystroke). Its model is `render(index)` — a **pure
per-pixel function**, inherently seekable and parallelisable.

**[Hydra](https://hydra.ojack.xyz/docs/)** — chained JS DSL compiling to WebGL. Noted because of the recent `LedStrip shader`
work: a per-pixel script function is the shape that could eventually compile to GPU.

Also surveyed: **MADRIX MAS Script** (C-like, the commercial incumbent for LED effect scripting), **Roblox Luau** (gradual
typing over a dynamic language), and the **Prisma / GraphQL Codegen** pattern of generating types from a schema — the direct
precedent for "environment-aware".

---

## 4. Decisions

### D1 — Language: stay with TypeScript

The decisive argument is not inertia. `@typescript/vfs` gives us **a real language server for free** — autocomplete, hover,
diagnostics, go-to-definition, rename refactoring, from the compiler VS Code itself uses. Nothing else comes close; picking
Rhai/Rune (despite existing Rust infrastructure in `lms_bridge` and `src/rust`) or Luau means hand-writing an LSP.

Beyond tooling, TypeScript's type system is unusually well suited to this specific problem: literal types, branded types and
template-literal types are precisely the tools for encoding "this strip has 60 LEDs" and "this fixture has a channel named
`dimmer`" into the type system. A generated `.d.ts` is a first-class citizen, not a bolt-on.

**What TypeScript does not give us:** sandboxing (`eval` in the main realm), execution limits, or runtime type enforcement.
See D3 and §5.6.

**What would change this decision:** wanting scripts to run on the ESP32 / bridge side rather than in the app. That flips the
calculus entirely toward a small embeddable interpreter.

### D2 — Arbitration: layers with blend modes

Each source (graph item, script item) produces a **layer**; the stage composites them. This replaces the `uncontrolledFixtures`
mechanism. Rationale: it is the only model that lets a chase run over a wash, and doing it later means refactoring the graph
output path twice.

### D3 — Execution: main thread, no sandbox

Project files are personal-use only; they are not shared or opened from untrusted sources. Keep scripts on the main thread with
an ergonomic *synchronous* fixture API. A Worker would sandbox better but forces the whole API async, which costs more than it
buys here. Runaway loops are handled by a compile-time guard (§5.6), not isolation.

Revisit if project sharing ever becomes a feature.

### D4 — Authoring model: generator sequences, with the pure per-frame model as a special case

Primary use is **timed choreography** and a **reusable pattern library**. Generators (`yield*`) are the right ergonomic for
sequencing. The pure per-frame model falls out for free as `while (true) { …; yield; }`, so one engine covers both.

### D5 — Identity: names break loudly, with rename refactoring

Generated identifiers key on fixture *name* (slugified); the underlying binding resolves through the uuid behind a branded type.
A rename produces immediate diagnostics plus an offered rename refactor across all scripts. Deletion produces both diagnostics
and a load-time validation error. Preferred over silent auto-follow because script text and project state stay in visible
agreement.

---

## 5. Architecture

### 5.1 Layer model

Every source produces a per-fixture layer instead of writing the fixture directly.

```ts
interface LedStripLayer {
    rgb: Float32Array; // numLeds * 3
    alpha: Float32Array; // numLeds — 0 = transparent
}

interface DmxLayer {
    channels: Float32Array; // one per channel
    mask: Uint8Array; // 1 = this layer wrote this channel
}
```

**Per-pixel alpha is load-bearing.** "Did not touch this pixel" must mean *transparent*, not black — otherwise a chase layered
over a wash blacks out everything it is not currently lighting.

Compositing runs bottom-to-top per fixture:

```
value = mix(below, blend(below, above, mode), alpha * itemOpacity)
```

**Ordering:** track order is z-order. This maps onto the existing vertical track stacking and reads like a video editor. Blend
mode and opacity become timeline-item properties.

**Two implementation caveats:**

- *chroma-js is too slow here.* `blend()` in `src/graph/colors.ts` constructs `Color` objects per call, and `Color = [number,
  number, number]` means a tuple allocation per pixel. A compositor running per-pixel × per-layer × per-frame needs flat numeric
  blend functions over `Float32Array`. Keep chroma-js for the graph nodes, where call volume is low.
- *DMX cannot use colour blend modes.* Screen-blending a gobo-selection channel produces garbage. The OFL definitions already
  carry capability types (`src/stage/fixtures/dmx/fixture-schemas/capability.json`), so derive per-channel behaviour from them:
  intensity and colour channels blend numerically (max / add / mix), selection channels are replace-where-masked.

**Migration:** graphs move onto this first. `applyGraphResults` currently walks `CalculationResult` looking for `fixtureId` /
`data` pairs and calls `fixture.setValue` — it instead writes a fully-opaque layer, and the `resetValue()` loop is replaced by a
zeroed base layer under the stack.

### 5.2 Sequence runtime

```ts
export default defineSequence({
    uses: { strip: stage.Ceiling, spot: stage.SpotLeft },
    *run(s) {
        yield* s.all(s.spot.channel("dimmer").to(255, beats(0.5)), s.strip.fadeTo(RED, beats(1)));
        yield* wait(beats(4));
        yield* repeat(8, (i) => chase(s.strip, BLUE, { step: beats(0.25) }));
    },
});
```

Scheduler modelled on Motion Canvas's threads:

- `yield` — advance one tick
- `yield* wait(ticks)` / `yield* tween(target, from, to, duration, easing)`
- `yield* all(...gens)` / `race(...)` / `spawn(gen)` — fork child generators, stepped within the same tick

```ts
class SequenceRuntime {
    private root: Thread;
    private lastTick = -1;

    advanceTo(localTick: number, ctx: TickContext): Layer {
        if (localTick < this.lastTick) this.reset(); // seek backwards → replay from item start
        while (this.lastTick < localTick) {
            this.lastTick++;
            this.frame.clear();
            this.root.step(this.frame, ctx);
        }
        return this.frame;
    }
}
```

**Seeking is replay.** Generator state cannot be cloned, so snapshotting is impossible and replay is the only option. At
`TICKS_PER_BEAT = 24`, a 32-bar item is ~3000 ticks — a few milliseconds.

**The frame-buffer design is what makes replay safe and cheap.** Because a sequence's only side effect is writing into its own
layer buffer, fast-forward replay can skip buffer writes entirely and run only control flow. Direct `fixture.setValue()` calls
could never be replayed this way. This is the strongest argument for the layer model beyond compositing itself.

**Determinism:** all randomness is seeded per item — `ctx.random()`, `ctx.noise()` (we already depend on `open-simplex-noise`).
Renders must reproduce exactly.

### 5.3 One shared TypeScript environment

Replace the per-editor `createVirtualTypeScriptEnvironment` in `ScriptEditor.vue:39` with a project-level
`useScriptEnvironment()` store owning one `fsMap` and one env:

```
/lib.lmsApi.d.ts      generated from the API source at build time
/lms.stage.d.ts       generated from live stage state
/scripts/<id>.ts      every SCRIPT library item
/lib/<name>.ts        every SCRIPT_LIBRARY library item
```

Four capabilities unlock together:

- `import { chase } from "@lib/chase"` resolves and type-checks → **gap 5**
- Rename refactoring works across all scripts (`languageService.findRenameLocations` needs one shared program) → **D5**
- Diagnostics for *closed* scripts surface in the library panel
- Compile-on-project-load becomes straightforward → **gap 3**

**Also fix:** `lib.lmsApi.d.ts` is currently hand-written and duplicates the real implementations in `src/scripting/api/`, so it
will drift. Emit it at build time with `tsc --declaration` over the API source and import via `?raw`. Then the runtime API and
the script-facing types cannot disagree.

**Also verify:** `ScriptEditor.vue` registers `/lmsApi.d.ts` but passes `lib: ["dom", "es2022", "lmsApi"]`. TypeScript resolves
lib entries to `lib.<lowercased>.d.ts`, so this may be silently not loading. Passing the definitions as additional root files is
cleaner than the `lib` mechanism either way.

### 5.4 Generated environment types

Regenerated on stage change and pushed in via `env.updateFile()`:

```ts
// /lms.stage.d.ts
declare namespace stage {
    /** DMX · Cameo Flat PRO 7 · mode "8ch" · start channel 1 */
    const SpotLeft: DmxFixture<"dimmer" | "red" | "green" | "blue" | "strobe">;
    /** LED Strip · 60 LEDs */
    const Ceiling: LedStrip<60>;
}

declare namespace tracks {
    const KickEnergy: AutomationTrack; // .value: number
    const Melody: PatternTrack; // .notes: readonly Note[]
}
```

This is the core of "environment-aware":

- Deleting a fixture makes `stage.Ceiling` a **diagnostic at edit time**, not a runtime error
- `SpotLeft.channel("dimmer")` — channel names from the OFL definition, typo-checked, no magic indices (**gap 1**)
- `LedStrip<60>` puts the pixel count *in the type*
- `tracks.KickEnergy.value` is `number`, not `number | INote[]` — the union in `trackValues` disappears

### 5.5 Load-time validation via the `uses` manifest

The `uses` block declares dependencies, so the host can inspect a script **without executing it**:

- **On project load:** *"Script 'Chase' references fixture 'SpotLeft' which no longer exists"* with a remap dialog, instead of a
  silent no-op or a mid-playback crash
- **Layer registration:** the host knows which fixtures a script drives → **gap 2**
- **Conflict detection:** *"Chase and Strobe both drive Ceiling"*
- **UI:** show dependencies in the library and timeline

Edit-time diagnostics only help while the editor is open; this is the layer that catches everything else.

### 5.6 Pattern library

Patterns are plain generator functions parameterised over a target — no host magic required:

```ts
// /lib/chase.ts
export function* chase(strip: LedStripHandle, color: Color, opts: { step: Ticks }) {
    for (let i = 0; i < strip.length; i++) {
        strip.set(i, color);
        yield* wait(opts.step);
    }
}
```

Used as `yield* chase(s.strip, RED, { step: beats(0.25) })`. Fully typed, fully composable. This is where the TypeScript
decision pays off most heavily against a custom DSL.

Strudel-style combinators (`seq`, `stack`, `every`, `fast`, `euclid`) belong here as a library, not as a parser. If the
mini-notation ergonomic is wanted later, a tagged template (``pat`bd*4 [hh hh]` ``) can sit on top without a separate engine.

### 5.7 Safety — loop guard

Per D3 there is no sandbox, so a `while (true)` without a `yield` would hard-freeze the app *and* the offline renderer. Since we
already run `ts.createProgram`, add a transformer that injects an iteration counter into every loop body, **budgeted per tick**
rather than per loop. A per-tick budget correctly permits `while (true) { …; yield; }` — the yield ends the tick and resets the
budget — while still catching genuine runaways.

Additionally: wrap each tick in try/catch and auto-disable a script after N consecutive errors, surfacing the error in the
library panel.

---

## 6. Open questions

- **`ScriptNode` (gap 6).** Retire it in favour of typed scripts, or give it the same generated types? Two scripting stories in
  one app is a maintenance cost either way.
- **Long-item replay.** A 5-minute item at heavy per-tick cost could make scrubbing sluggish even with buffer writes skipped. Is
  a "sequences are re-entrant from bar boundaries" contract worth imposing to allow coarser replay anchors?
- **Live editing.** Not a stated priority (D3/§4), but if it becomes one, Sonic Pi's swap-at-bar-boundary is the model, and it
  interacts with replay-on-seek in ways worth thinking through before committing.
- **Strudel-style playhead highlighting** — showing which line of a script produced the current fixture value. High debugging
  value; needs source-mapped attribution through the layer write path. Worth designing the layer write API to keep it possible.

---

## 7. Implementation plan

| # | Step | Addresses |
|---|---|---|
| 1 | **Layer compositing** — layer types, numeric compositor, DMX channel-type behaviour; migrate graphs onto it, replace `uncontrolledFixtures` | D2, gap 2 |
| 2 | **Project-level shared TS environment** — replace the per-editor env | gap 8 |
| 3 | **Generated `lms.stage.d.ts`**; build-time-generated `lib.lmsApi.d.ts`; fix the `lib` resolution | gap 1 |
| 4 | **`defineSequence` + generator scheduler** with replay-on-seek and seeded randomness | D4, gap 4 |
| 5 | **`uses` manifest** — load-time validation, layer registration, conflict detection | gap 2 |
| 6 | **`SCRIPT_LIBRARY` as `/lib/*.ts`** + combinator/pattern library | gap 5 |
| 7 | Rename refactor integration, loop guard, compile-on-load, buffer-oriented fixture API | D5, gaps 3, 7 |

Steps 1 and 2 are pure refactors with no user-visible feature attached, which is unglamorous — but every later step gets
substantially harder if they land afterwards, and step 1 in particular would have to be done twice.
