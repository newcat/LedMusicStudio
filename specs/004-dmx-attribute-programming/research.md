# Research: Attribute-Based DMX Fixture Programming

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-14

Each entry: **Decision**, **Rationale**, **Alternatives considered**. Code references are to the state of `main` at commit `b20d6fb`.

---

## R1 — Attribute vocabulary and units

**Decision**: Attributes are a small fixed set that maps onto the existing `CapabilityKey`s of feature 003 (`src/visualization/capabilities/types.ts`):

| Attribute | Kind | Unit / value | Capability keys written |
|---|---|---|---|
| `dimmer` | continuous | 0–1 | `dimmer` (falls back to the cells' dimmers) |
| `shutter` | structured | `{ mode: "open" \| "closed" \| "strobe", rate: Hz }` | `shutter` |
| `pan`, `tilt` | continuous | degrees, 0 = center of the range (same space as the mapping, see below) | `pan`, `tilt` (16-bit) |
| `panTiltSpeed` | continuous | 0–1, 1 = fastest | `panTiltSpeed` |
| `color` | continuous (vector) | sRGB triple 0–1 | `red`…`coldWhite`, `cyan`/`magenta`/`yellow`, `colorWheel` (R3) |
| `colorTemperature` | continuous | Kelvin | `colorTemperature` |
| `colorWheel` | discrete | 1-based slot number | `colorWheel` |
| `colorMacro` | discrete | 1-based index of the macro's color segments | `colorMacro` |
| `goboWheel` | discrete | 1-based slot number | `goboWheel` |
| `goboRotation` | continuous | rps, signed | `goboRotation` |
| `prism` | discrete | 1-based slot number (0 = off) | `prism` |
| `prismRotation` | continuous | rps, signed | `prismRotation` |
| `zoom` | continuous | 0–1 over the fixture's beam-angle range (0 = narrowest) | `zoom` |
| `focus` | continuous | 0–1 (0 = near) | `focus` (**new key**) |

- `autoMap.ts` already centers pan/tilt so that 0° is the middle of the range and the model's rest pose (`autoMap.ts:389`). The attribute uses this exact value space. "Relative to the center" in FR-003 is therefore the mapping's own unit, and the inverse-kinematics result (R11) can be written without conversion.
- Pan/tilt fall back to 0–1 when the pan/tilt entry of the mapping is not a degree range. This happens only if the OFL definition has no angles **and** no fixture model gives `movingParts` limits (autoMap already uses model limits as fallback).
- `focus` is not a capability key yet. Add it to `CapabilityKey`, `KEY_INFO` and `KEYS_BY_TYPE` (Moving Head, Spot), and map OFL `Focus` capabilities to it in `autoMap.ts` (linear, near→far). The renderers ignore it.
- Wheel-rotation keys (`colorWheelRotation`, `goboWheelRotation`) and the special-effect keys (`laser*`, `trigger`, `height`, `fogOutput`) get no attributes in this feature. They stay reachable through raw output (spec "Out of scope" / FR-013).

**Rationale**: Reusing the mapping's keys means the encoder is the exact inverse of the decoder the preview already uses. The preview then shows precisely what was programmed (FR-014, SC-002).

**Alternatives considered**: An OFL-driven attribute model independent of the mapping was rejected: it would duplicate 1100 lines of autoMap logic and let preview and output disagree. Exposing every capability key 1:1 (`red`, `green`, …) as attributes was rejected: users want "color", and graphs would stop being fixture-independent.

---

## R2 — Where the capability mapping lives (FR-002)

**Decision**: The mapping stays where feature 003 stores it, in the fixture visualization config of the scene object. Programming resolves a fixture's mapping like this:

1. If a scene `FixtureVisualizationObject` is linked to the fixture (`fixtureId`) and its config has a `mapping`, use it.
2. Otherwise, generate one in memory with `autoMapCapabilities(definition, mode, inferredType, null)`, where the inferred type is Moving Head if the mode has a Pan or Tilt channel, Generic Fixture if the definition has a matrix, otherwise Spot. The result is cached by fixture id, definition/mode identity and channel count. It is not stored.

The resolver lives in the main window only (`src/programming/profile.ts`). Spec FR-002 was reworded accordingly.

**Rationale**:
- Moving the mapping into `DmxFixture` would need a migration of every 003 project and a change of show-window protocol v3, because the show window has no stage store and reads the mapping from the config.
- `autoMapCapabilities` depends on the visualization type (`KEYS_BY_TYPE`, cells for Generic only), so a fixture-owned mapping would also need a type-independent auto-map variant.
- The resolution above gives the user-visible behavior the spec asks for (one mapping, corrections apply to both, fixtures without a scene object are programmable) with no format change. This follows constitution V.

**Alternatives considered**: A fixture-owned mapping, with visualizations referencing it, was rejected for the migration and protocol cost above. A mapping editor for fixtures without a visualization is not needed now: adding a visualization is one click, and the automatic mapping covers the common case.

---

## R3 — Encoder: attributes → DMX

**Decision**: A pure module `src/programming/encode.ts` inverts the segment types of the mapping:

- **linear / angle**: find the segment whose `[start, end]` contains the value (closest segment if none does, clamped). Then `raw = from + (v − start) / (end − start) · (to − from)`, rounded, on the 16-bit scale when `fine ≥ 0` (8-bit bounds × 257, matching `rawSpan` in `decode.ts`). Write `coarse = raw >> 8` and `fine = raw & 255`.
- **wheelSlot**: prefer a segment with `slotStart === slotEnd === slot` and use its midpoint. Otherwise use the position inside a scrolling segment that yields the exact slot.
- **shutter**: `open`/`closed` take the midpoint of the matching segment. `strobe` takes the `strobe` segment whose rate range contains the requested rate, interpolated (closest rate if none matches). Without a shutter channel, `closed` sets the dimmer to 0 and strobe is ignored.
- **rotation**: same as linear on `speedStart…speedEnd`. 0 rps picks a segment containing 0, otherwise a `none` or stop segment.
- **color** (`color` attribute, sRGB 0–1):
  1. Additive mixing (any of `red`, `green`, `blue` mapped): extract `white = min(r,g,b)` if `white` is mapped and subtract it from RGB. Amber, lime, UV, indigo and warm/cold white get 0. Warm/cold-white-only fixtures (no RGB) use `colorTemperature` instead (R3 note below).
  2. Subtractive (`cyan`/`magenta`/`yellow`): `c = 1 − r`, etc.
  3. Wheel only (no mixing keys, `colorWheel` mapped): pick the slot with the smallest OKLab distance among `open` (treated as white #ffffff) and `color` slots with exactly one color. Split-color slots are excluded (spec FR-006).
  4. If the user also sets `colorWheel` explicitly, the explicit slot wins for the wheel channel and RGB still drives the mixing channels.
  5. Multi-cell fixtures without fixture-wide color keys: the same color is written to every cell's channels (`CellMapping`).
- **colorTemperature**: linear inverse on the `colorTemperature` entry. RGB-only fixtures convert Kelvin to RGB with the same approximation `colorMath.ts` uses for decoding.
- Mapped keys without an attribute value take the attribute default (R4). Unmapped channels take the OFL channel `defaultValue` if numeric (or a percentage string converted), else 0 (FR-013).

The per-fixture encoding tables (which channel indices each attribute writes, sorted segment lists, wheel OKLab colors) are precomputed in a `FixtureProfile` (data-model §1). They are cached until the mapping, mode or start channel changes.

**Rationale**: Exact inversion of `decode.ts` guarantees the round trip `decode(encode(v)) ≈ v`. OKLab is a few lines of math (no dependency) and gives a better "closest color" than RGB distance.

**Alternatives considered**: Split-color slots for in-between colors were rejected by the spec. CIEDE2000 was rejected: much more code, no visible benefit for wheels with 6–12 slots.

---

## R4 — Merge engine and priorities (FR-009–FR-013)

**Decision**: A new per-frame engine (`src/programming/engine.ts`) replaces `applyGraphResults` / `uncontrolledFixtures` for **DMX fixtures**:

1. Every active timeline item produces `Contribution`s (data-model §5): per fixture, attribute values or raw channel values, each with a mode (`absolute` / `relative`) and a weight 0–1 (fades).
2. Contributions are sorted by priority: the item's track index ascending (the last track in `timeline.tracks`, shown lowest, has the highest priority), then by item start ascending. Later entries win.
3. Per fixture, the engine starts from the defaults (fixture overrides first, then built-in defaults) and folds the contributions in priority order:
   - absolute continuous: `v = lerp(v, value, w)` (color per component, pan/tilt as angles, R9)
   - absolute discrete: `v = w ≥ 0.5 ? value : v`
   - relative (effects): `v = clamp(v + offset · w)`
   - `shutter` is treated as discrete
4. The engine records the priority of the layer that last wrote each attribute.
5. Encoding (R3) turns attributes into channels. The encoder reports which channels each attribute wrote.
6. Raw contributions (raw DMX output node) are applied per channel. A raw value wins over a channel if its priority is higher than the priority of the attribute that produced that channel, or if no attribute did.
7. The resulting `number[]` goes to `fixture.setValue`, unchanged from today, so preview, show window and controllers get it as before (FR-014).

Non-DMX fixtures (LED strips, WLED, Razer Chroma) keep the current path: last writer per fixture, `resetValue` when uncontrolled (FR-015). Scripts still run after the merge and write raw values directly. This is unchanged behavior; scripts are an escape hatch with implicit top priority.

Statelessness (FR-011): the engine keeps no state between frames. Effect phases come from the timeline position (R8). Fades come from the position inside the item.

**Behavior change**: today the order in which overlapping graphs are applied follows `timeline.items` array order, not track order. Projects where two graphs drive the same DMX fixture at the same time can change. This must be stated in the commit message (constitution IV).

**Rationale**: This is the smallest change that gives per-attribute layering and keeps raw output, scripts and LED strips working.

**Alternatives considered**: Merging per channel only (no attributes in the stack) was rejected: relative effects and fades need attribute values. A priority number per item was rejected: track order already expresses priority (spec decision).

---

## R5 — Timeline items and tracks (FR-018, clip targets, fades)

**Decision**:
- `Track` gets `defaultTarget: Target | null`, saved in `ITrackState`.
- `Item` gets `target: Target | null`, `fadeIn` and `fadeOut` (timeline units, 24 per beat), saved in `IItemState`.
- A new item inherits `defaultTarget` from its track when created (drop from library, paste). Moving an item to another track keeps its target.
- `Target` is `{ kind: "group", id } | { kind: "fixture", id }`.
- Fade handles are shown and editable only for items whose library item is a Look or an Effect (spec assumption: no fades on graphs).
- Graph items use `target` only when an Attribute Output node is set to "Clip target" (R7).

**Rationale**: Clip-level targets make looks, effects and graphs reusable across groups, which is what "default target per track" implies. `Track.data` exists but is untyped, so typed fields are preferred (constitution II).

**Alternatives considered**: Storing the target on the library item was rejected because the same look could not then be used for two groups. Requiring targets on all items was rejected because audio, automation and pattern items have none.

---

## R6 — Groups and spatial ordering (FR-016, FR-017, FR-019)

**Decision**:
- Groups live in the stage store (`StageState.groups`) next to fixtures and controllers. Members are DMX fixture ids only.
- Ordering is `{ mode: "manual" }` with the member order as stored, or one of the automatic modes:
  - left-to-right / right-to-left: world X ascending / descending
  - front-to-back / back-to-front: world Z descending / ascending (the audience is at +Z, see the default camera in `scene/model/defaults.ts`)
  - bottom-to-top / top-to-bottom: world Y
  - distance from center: distance to the scene origin
- Positions come from `getWorldMatrix(scene, objectId)` of the linked visualization object (`transformMath.ts`). Ties break by manual order. Fixtures without a scene object come last, in manual order.
- The resolved order is computed (a getter), not stored, so it follows fixture moves automatically.
- Deleting a fixture removes it from all groups (stage `removeFixture`). Deleting a group sets the targets that reference it to unresolved; such items show a warning and produce nothing.
- UI: a new "Groups" panel in the Stage view next to Fixtures and Controllers.

**Rationale**: The stage already owns fixtures, and groups are part of the rig, not of the show.

**Alternatives considered**: Groups as scene `group` objects were rejected because scene groups are spatial (transform hierarchy) and would mix two concepts. Groups as library items were rejected because the library is per-show content, not rig.

---

## R7 — Per-fixture graph evaluation (FR-007, FR-020, FR-021)

**Decision**:
- **Attribute Output node** (`output/AttributeOutputNode.ts`):
  - Target option: "Clip target" (default), a group, or a fixture.
  - One input per attribute of R1. Discrete attributes take a slot number. The node shows slot names for the first target fixture as a hint.
  - Inputs that are not connected and have no value set are "unset" and emit nothing. Each input has a "set" toggle, so an unconnected input is unset by default.
- **Fixture Input node** (`input/FixtureInputNode.ts`): outputs index, normalized index, position x/y/z, hasPosition and group size, read from a new `ICalculationData.fixture` field. Without a fixture context it outputs index 0, normalized 0, size 1.
- **Evaluation**:
  - If a graph contains no Fixture Input node, it runs once and its attribute outputs apply the same values to every fixture of their target.
  - If it contains a Fixture Input node, all its Attribute Output nodes must resolve to the same fixture list (otherwise a graph error: "Per-fixture graphs need one common target"). The graph runs once per fixture with `fixture` set, and each run's outputs apply to that fixture only.
  - Raw DMX and LED strip outputs of a per-fixture graph are taken from the first run only.
- **Stateful nodes**: Afterglow, Particle, ADSR, Trigger, Noise, Switch and TrackInput keep instance state today. They get a small helper `perFixtureState(node, ctx, init)` that keys the state by the fixture index (key 0 without context), so N runs per frame do not mix their state.
- **Performance**: Baklava's `DependencyEngine.runOnce` recomputes the topological order per run. For per-fixture graphs, run the engine via `runGraph` with a precomputed order, if the plan's spike (tasks) shows `runOnce` is too slow at 32 fixtures × 30 fps. Budget: ≤ 10 ms per frame for SC-005.

**Spike result (T031, 2026-11-14)**: `DependencyEngine` already caches the topological order between runs, so a precomputed order gains nothing. The cost of `runOnce` is its run events plus Vue proxies (library items are `reactive`): a 20-node graph × 32 runs took 18–33 ms (dev and production builds). Calling `runGraph` on the raw engine and graph took 5.9 ms. Implementation: the first fixture of a per-fixture graph runs through `runOnce` (events, order refresh, `applyResult`), the others through the raw `runGraph`. Measured with 32 heads, the 20-node per-fixture graph, a circle effect and a look (dev build): graphs 6.9 ms on average (10.2 ms max), merge and encode 0.66 ms (1.3 ms max). Of the 7 stateful nodes, Switch is commented out and TrackInput keeps no per-run state, so 5 nodes use `perFixtureState`.

**Rationale**: Running the existing engine per fixture reuses every existing node unchanged, except the 7 stateful ones. The common-target rule keeps the semantics obvious.

**Alternatives considered**: Vectorized nodes (each value an array over fixtures) were rejected: every node would need rewriting, and the LED-strip nodes already use arrays for pixels, which would be confusing. Cloning the graph per fixture was rejected because of memory use and duplicate state handling.

---

## R8 — Effect engine (FR-022–FR-026)

**Decision**: Pure module `src/programming/effects.ts`.

- **Phase** of fixture `i` (position in resolved group order, reversed if `direction = backward`) out of `n`:
  1. `s = ceil(n / wings)` and `k = i mod s`. If `floor(i / s)` is odd, then `k = s − 1 − k` (mirror).
  2. `k = floor(k / blocks)`.
  3. `k = k mod interleave` when `interleave > 1`.
  4. `m` = the number of distinct `k` values after steps 1–3 (`ceil(s / blocks)`, then `min(·, interleave)`).
  5. `offset = spread · k / m` (degrees, spread 0–360+).
- **Time**: `t = (position − item.start) / (rateBeats · 24) + offset / 360`. This is derived from the timeline position, so playback and scrubbing agree (FR-011), and the speed follows BPM automatically because units are beats.
- **Shapes** return −1…1 (or two values for pan/tilt shapes):
  - sine, triangle, saw up, saw down, square (duty 50 %)
  - circle `(cos, sin)` and figure-8 `(sin, sin 2x)` for pan + tilt
- **Value**:
  - absolute: `base + size · shape`
  - relative: `offset = size · shape`, folded as a relative contribution
  - dimmer, zoom and focus shapes are remapped to 0…1 (`(shape + 1) / 2`), so "size" is the swing
  - color effects: `lerp(colorA, colorB, (shape + 1) / 2)`, always absolute
- **Fades**: the fade weight scales `size` (relative) or the contribution weight (absolute).

**Rationale**: The wings, blocks and interleave formulas match common console behavior (MA phasers, ChamSys FX "groups") and stay simple.

**Alternatives considered**: User-drawn shapes or step lists (phaser steps) were deferred: no spec need. Hz-based rates were rejected because beat sync is the point for a music tool.

---

## R9 — Looks, fades and fan values (FR-027–FR-029)

**Decision**:
- **Look values per attribute**:
  - `{ kind: "single", value }`
  - `{ kind: "fan", from, to, mirror }`: per fixture `lerp(from, to, p)` with `p = i/(n−1)`. Mirrored: `p = 1 − |2i/(n−1) − 1|`.
  - `{ kind: "preset", presetId }`
  - `{ kind: "aim", targetId }` (position only, R11)
- **Fade weight** at item-relative position `x` with item length `L`: `w = min(1, x / fadeIn, (L − x) / fadeOut)` (a fade of 0 counts as 1). Fades longer than half the item are clamped to `L/2`.
- **Fan timing** (`fanTiming` 0–1, direction from group order): each fixture's fade lasts `F · (1 − f)` and starts after `F · f · p_i`, so the whole fade still fits in `F` (FR-029).
- **Interpolation**:
  - continuous attributes interpolate linearly in their unit; pan/tilt in degrees (accepted edge case)
  - color in linear RGB, converted back to sRGB for encoding, which avoids dark midpoints
  - discrete attributes switch at `w = 0.5` (the fixture's own weight with fan timing)

**Rationale**: Folding with weights in the merge engine (R4) gives crossfades between overlapping looks for free. The lower layer is the "from" value.

**Alternatives considered**: Explicit crossfade objects between clips were rejected because overlap plus fade handles is the DAW convention and needs no extra entity.

---

## R10 — New library item types (looks, effects, presets)

**Decision**:
- Three new `LibraryItemType`s: `LOOK`, `EFFECT` and `PRESET` (a preset has `presetKind: "position" | "color" | "beam"`).
- Each gets a `*.libraryItem.ts` with `save`/`load`, an editor component in `UnifiedEditor.vue`, and a preview for the timeline item.
- Looks reference presets by id.
- Deleting a preset that is in use shows a confirm with the number of uses. On confirm, every referencing look value is replaced by the preset's values as they were ("baked"): common value → `single`; per-fixture values → a new look field `perFixture` override map.
- Placement on the timeline works like graphs and automation clips today. Looks and effects are reusable; the target is per item (R5).
- The attributes each preset kind may hold:
  - position: pan, tilt, or an aim target
  - color: color, colorWheel, colorTemperature, colorMacro
  - beam: goboWheel, goboRotation, prism, prismRotation, zoom, focus, shutter

**Rationale**: The library is the app's existing place for reusable content, with editors, naming and persistence. Looks and effects fit it the way graphs do.

**Alternatives considered**: Inline clip data (not reusable) was rejected. Presets in the stage store were rejected: presets are show content, and position presets depend on the show.

---

## R11 — Aim targets and inverse kinematics (FR-032–FR-035)

**Decision**:
- **Scene object**: a new scene object kind `aimTarget`: `SceneObjectBase<"aimTarget">` with no extra fields. The scene model already keeps unknown kinds verbatim, so this only adds it to `KNOWN_KINDS` with sanitize rules.
  - The editor viewport draws a small crosshair gizmo. The show window does not render it (editor-only, like labels).
  - It appears in the outliner and is moved with the existing transform tools.
- **Forward model** in the fixture model frame:
  - The beam at rest points along `beam.direction` (default +Y).
  - Pan rotates about `movingParts.pan.axis` (default Y). Tilt rotates about `movingParts.tilt.axis` (default X), applied after pan.
  - This is the order `FixtureBody.setPanTilt` uses: the tilt node is a child of the pan node, and both rest quaternions are identity in the built-in catalog. A task verifies this for every moving-head model and adds a `restRotation` note to the contract if any model differs.
- **Inverse**:
  - Transform the target into the fixture model frame (inverse world matrix of the visualization object, including `modelScale`).
  - `pan = atan2` of the direction projected onto the plane perpendicular to the pan axis. `tilt` = angle between the rest beam (after pan) and the direction.
  - Both solutions `(pan, tilt)` and `(pan ± 180°, −tilt)` are checked against the mapping's pan/tilt ranges. Pick the valid solution with |pan| closest to 0 (the center, FR-034).
  - If none is valid, clamp the better one and report the fixture as "out of range".
- **Fixtures without a scene object or model**: fall back to centered pan/tilt with a warning (FR-035).
- **Cost**: computed per frame per aimed fixture. A few trigonometric operations, no caching needed.

**Rationale**: Analytic inverse kinematics using the model contract of feature 002 is exact and cheap. SC-008 (0.1 m) is checked visually in the preview.

**Alternatives considered**: Numerical solving against a live `FixtureBody` was rejected: the programming engine must not depend on Three.js scene objects (the module rule of features 001–003). Animated targets are out of scope (spec).

---

## R12 — Performance

**Decision**:
- Budget per frame at 30 fps for SC-005 (32 heads, one per-fixture graph, one effect, one look): graph runs ≤ 10 ms, engine and encoding ≤ 2 ms.
- The engine reuses typed arrays per fixture (no per-frame allocation in the fold and encode loop).
- Profiles (R3) are cached.
- Group orders are cached and invalidated on scene or group changes (Vue `computed`).
- A dev-console helper `programming.debug()` prints per-frame timings, like `describeMapping` from feature 003.

**Rationale**: The timeline ticks with `setInterval(1000/fps)` and awaits async graph runs. Overrunning the budget delays all output.

**Alternatives considered**: Moving the engine to a worker or WASM was rejected as premature (constitution V). Revisit only if the budget is missed.

---

## R13 — UI placement

**Decision**:
- **Stage view**: a new Groups panel (list, members, ordering select, drag order). The fixture settings get a "Defaults" section (per-attribute override, only the attributes the fixture supports).
- **Timeline**:
  - Track settings get "Default target".
  - The item context menu gets "Target…".
  - Look and effect items show fade handles (draggable triangles at the top corners, like DAW clips) and a warning badge for missing targets or unreachable aim targets.
- **Editors** in `UnifiedEditor.vue`:
  - Look editor: attribute rows with single / fan / preset / aim value and fan timing.
  - Effect editor: attribute, shape, size, base, rate, spread, wings, blocks, interleave, direction, mode, plus a small phase preview strip over the group.
  - Preset editor: kind, common value, per-fixture table.
- **Scene editor**: "Add aim target" in the add menu. Look and position-preset editors pick targets by name.
- **Graph editor**: the two new nodes are in the existing node palette (Output, Input categories).

**Rationale**: Every new piece goes into the place where the related existing piece already lives.

**Alternatives considered**: A separate "Programmer" view was rejected as a live-console feature (out of scope).

---

## R14 — Persistence and compatibility (FR-036, constitution IV)

**Decision**: Additive fields only:
- `StageState.groups`
- `DmxFixtureConfiguration.defaults`
- `ITrackState.defaultTarget`
- `IItemState.target`, `fadeIn`, `fadeOut`
- the new library item states
- scene objects of kind `aimTarget`

Missing fields load as empty or `null`. Old projects load unchanged. Raw DMX output nodes behave as before when they are the only source for a fixture (SC-006).

The track-order priority change (R4) is the only behavior difference and must be stated in the commit message.

**Rationale**: No migration code is needed. This keeps within constitution IV, which allows breaks but asks to announce them.

**Alternatives considered**: A format version bump was not needed because everything is additive.

---

## R15 — Dependencies

**Decision**: No new runtime dependency. Everything is in-house TypeScript (OKLab, inverse kinematics and the phase math are a few dozen lines each) on top of Vue, Pinia, PrimeVue, BaklavaJS and three (only `Matrix4` / `Vector3` from `transformMath.ts` for inverse kinematics; no scene graph). No Rust, WASM or bridge change.

**Rationale**: Constitution V.
