---

description: "Task list for feature 004: attribute-based DMX fixture programming"
---

# Tasks: Attribute-Based DMX Fixture Programming

**Input**: Design documents from `specs/004-dmx-attribute-programming/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Not requested (constitution III: manual verification). No test tasks are generated. Each story ends with its quickstart scenarios (Q1–Q17).

**Organization**: Tasks are grouped by user story (US1–US8 from spec.md) so each story can be implemented and verified on its own.

**Quality gates per checkpoint**: `pnpm lint` and `pnpm build` must pass.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1…US8)
- Paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module skeleton and the one capability-key addition everything depends on.

- [X] T001 Create the module folder `src/programming/` with `index.ts` (re-exports, empty for now) and subfolders `look/`, `effect/`, `preset/`, `components/`, per plan.md "Source Code".
- [X] T002 [P] Add the capability key `"focus"` (research R1): extend `CapabilityKey` in `src/visualization/capabilities/types.ts`, add `focus: info("Focus", "ratio", 0.5, [0, 1], "linear")` to `KEY_INFO`, and add it to the Moving Head and Spot lists in `src/visualization/capabilities/keys.ts` (`BEAM_KEYS_WITHOUT_POSITION`). Make sure the beam renderer ignores it.
- [X] T003 Map OFL `Focus` capabilities to the `focus` key in `src/visualization/capabilities/autoMap.ts` (linear segment near→far mapped to 0…1, in `channelTargets` / `buildEntry`, like `Zoom`). Check with `describeMapping` in the dev console on a fixture with a focus channel (depends on T002).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The attribute model, encoder, mapping resolution and merge engine, wired into playback while existing behavior is kept. Every user story builds on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Implement `src/programming/attributes.ts` per `contracts/attributes.ts`:
  - `AttributeKey`, `AttributeValueMap`, `Rgb`, `ShutterValue`, and `ATTRIBUTES` (label, kind, unit, capabilityKeys) for all 15 keys of data-model §1.
  - `BUILT_IN_DEFAULTS`: "dimmer 0 · shutter open · pan 0 · tilt 0 · panTiltSpeed 1 · color white [1,1,1] · zoom 0.5 · focus 0.5 · goboRotation 0 · prism 0 · prismRotation 0". Wheel and colorTemperature defaults are profile-dependent.
  - `validateAttributeValue(key, value)` enforcing data-model §1: "clamped 0–1" for dimmer, panTiltSpeed, zoom, focus; "each 0–1" for color; "integer 1…slot count" for wheels; "0 = off, 1…slot count" for prism; "rate in Hz, ≥ 0" for shutter.
  - Pure module, no Vue or Pinia imports.
- [X] T005 [P] Implement `src/programming/color.ts` (pure, research R3/R9):
  - sRGB↔linear RGB, sRGB→OKLab, `oklabDistance`
  - `closestColorSlot(slots, rgb)`: candidates are slots of kind open (as #ffffff) and color slots with exactly one color; split colors excluded
  - `lerpColor(a, b, t)` in linear RGB
  - re-export the Kelvin→RGB approximation from `src/visualization/capabilities/colorMath.ts` (import it; do not duplicate it)
- [X] T006 [P] Add the shared types `Target`, `Priority`, `Contribution`, `AttributeContribution` and `FrameResult` to `src/programming/types.ts`, copied from `contracts/engine.ts`.
- [X] T007 Implement `src/programming/encode.ts` (pure, research R3), exported as `encodeAttributes(profile, mapping, definition, values): EncodeResult`. It is the exact inverse of `src/visualization/capabilities/decode.ts`:
  - **linear / angle**: find the containing segment, else the closest, clamped. Interpolate the raw value on the 16-bit scale when `fine ≥ 0` (×257 bounds like `rawSpan`). Write `coarse = raw >> 8` and `fine = raw & 255`.
  - **wheelSlot**: prefer a fixed-slot segment's midpoint, else the exact position in a scrolling segment.
  - **shutter**: open/closed segment midpoint. Strobe: the segment whose rate range contains the rate, interpolated, else the closest. Without a shutter channel, closed sets the dimmer to 0.
  - **rotation**: linear on speedStart…speedEnd. 0 rps uses a stop segment.
  - **color**, in this order:
    1. additive: white = min(r,g,b) if `white` is mapped; amber, lime, UV, indigo and warm/cold white set to 0
    2. CMY: c = 1−r, etc.
    3. wheel only: `closestColorSlot`
    4. an explicit `colorWheel` attribute wins for the wheel channel
    5. multi-cell fixtures without fixture-wide color: write the color to every `CellMapping`
  - **colorTemperature**: linear, or Kelvin→RGB on RGB-only fixtures.
  - Channels no attribute writes get `profile.channelDefaults`.
  - Return `writtenBy` per channel.
  - Depends on T004, T005.
- [X] T008 Implement `src/programming/profile.ts` (research R2):
  - `resolveMapping(fixtureId)`: use the `config.mapping` of the scene `FixtureVisualizationObject` whose `fixtureId` matches (via `useScene()`). Otherwise `autoMapCapabilities(definition, mode, inferredType, null)` with the inferred type: Moving Head if the mode has a Pan or Tilt channel, Generic Fixture if `definition.matrix`, else Spot. Cache the result by fixture id + definition/mode identity + channel count.
  - `getProfile(fixtureId): FixtureProfile | null` per `contracts/attributes.ts`: `supported` from the mapped keys; `panTiltNormalized` when the pan/tilt segments are not degree ranges; `ranges`; `slots` from `mapping.wheels` and the colorMacro color segments; `channelDefaults` from the OFL channel `defaultValue` (numbers as-is, "x%" strings scaled, else 0, FR-013); `defaults` = built-in defaults merged with `config.defaults` (T017) and wheel "open" slots.
  - Invalidate the cache with Vue `watch` on the scene objects, fixture config (definition, mode, startChannel) and fixture removal.
  - Depends on T004.
- [X] T009 Implement `src/programming/engine.ts` (pure, research R4), exported as `mergeFrame(contributions, dmxFixtureIds, getProfile, getMapping, getDefinition): FrameResult`. Per fixture:
  1. Start from `profile.defaults`.
  2. Sort contributions by priority `[trackIndex, start]` ascending.
  3. Fold: absolute continuous `v = lerp(v, value, w)` (color via `lerpColor`); absolute discrete `v = w ≥ 0.5 ? value : v` (shutter counts as discrete); relative `v = clamp(v + offset·w)` to `profile.ranges`. Record the writer priority per attribute (null = default).
  4. `encodeAttributes`.
  5. Raw override: a raw channel value wins if its priority is higher than the writer priority of `writtenBy[channel]`, or if that writer is null.
  6. Return `number[]` per fixture.
  - Reuse preallocated arrays per fixture; no per-frame allocation in the loops (research R12).
  - Depends on T004–T007.
- [X] T010 Implement `src/programming/processor.ts`, exported as `processProgramming(activeItems, unit, graphResultsByItem): FrameResult`:
  - Priority per item = `[index of item.trackId in timeline.tracks, item.start]`.
  - Convert graph results: each `Dmx Output` node result (`fixtureId`, `data`) of a DMX fixture becomes a raw contribution for all its channels (unset inputs = 0, as today).
  - Call `mergeFrame` for all DMX fixtures of the stage and apply `fixture.setValue(values)`.
  - Expose `warnings` per item id in a reactive map for the timeline UI.
  - Depends on T008, T009.
- [X] T011 Integrate into `src/timeline/baseTimelineProcessor.ts`:
  - Collect graph results per item instead of applying them directly.
  - `applyGraphResults` keeps handling **non-DMX** fixtures exactly as today, including the `uncontrolledFixtures` reset for non-DMX fixtures only.
  - Pass all DMX results to `processProgramming`.
  - Scripts still run after the merge, unchanged.
  - Depends on T010.
- [ ] T012 Verify the foundation: open a project from before this feature with raw DMX nodes and LED strip graphs. Output must be unchanged (spec SC-006, quickstart Q6, first part). With no clip on a DMX fixture, its output is the encoded defaults (dimmer 0, shutter open, pan/tilt centered).

**Checkpoint**: Engine in place, old projects play unchanged. User story work can begin.

---

## Phase 3: User Story 1 - Program a moving head by attributes (Priority: P1) 🎯 MVP

**Goal**: A graph sets semantic attributes on a fixture, and the correct DMX values come out for any fixture model.

**Independent Test**: Quickstart Q1–Q3. Two different moving-head models driven with the same attribute values show the same color, direction and brightness.

- [X] T013 [US1] Create the Attribute Output node in `src/graph/nodes/output/AttributeOutputNode.ts` (`defineDynamicNode`, type "Attribute Output"):
  - Target input: a select of DMX fixtures for now (groups and "Clip target" come in US3). Reuse the pattern of `SelectFixtureInterface`.
  - One input per attribute in the order of `contracts/programming-ui.md`. Each has an "enabled" checkbox, and connecting an input enables it.
  - Shutter as a mode select plus a rate number. Color via `ColorSingleInterface`.
  - `calculate` outputs `{ attributeTargets: string[], attributes: AttributeValues }` with only the enabled inputs.
  - Export it from `src/graph/nodes/output/index.ts`.
- [X] T014 [US1] Extend `src/programming/processor.ts` and `src/timeline/baseTimelineProcessor.ts` to recognize node results with `attributeTargets` (also inside `_calculationResults` of subgraphs). Each becomes an absolute contribution (weight 1) per target fixture at the item's priority. Attributes the fixture does not support are dropped. Depends on T013.
- [X] T015 [US1] Add UI hints to `AttributeOutputNode.ts`:
  - discrete inputs: a tooltip listing the slot names of the first target fixture from `getProfile(...).slots` ("1 Open · 2 Red · …")
  - pan/tilt labels: append "(0–1, no angle range)" when `panTiltNormalized` (FR-003, US1.4)
  - the node shows the error "Target not found" when the fixture is missing
- [ ] T016 [US1] Run quickstart Q1–Q3 in both targets: RGB, wheel and CMY models; 16-bit pan 90° round trip ±0.1°; fallbacks. Fix encoder issues found. Measure the time for SC-001 (< 1 min).

**Checkpoint**: US1 delivers value on its own (MVP): attribute programming of single fixtures from graphs.

---

## Phase 4: User Story 2 - Layer clips per attribute (Priority: P1)

**Goal**: Clips on different tracks combine per attribute, release cleanly, and fall back to per-fixture defaults.

**Independent Test**: Quickstart Q4–Q7. A position-only and a color-only clip overlap and both apply; outside the overlap, color is at its default.

- [X] T017 [P] [US2] Add `defaults?: AttributeValues` (default `{}`) to `DmxFixtureConfiguration` in `src/stage/fixtures/dmx/dmx.fixture.ts`. Save and load it with the config. On load, "drop keys with invalid values" (data-model §2) via `validateAttributeValue`. Keep keys the current mode does not support.
- [X] T018 [P] [US2] Create `src/programming/components/AttributeValueEditor.vue`: an editor per attribute kind (slider with unit for continuous values, PrimeVue ColorPicker for color, a select of slot names from the profile for discrete values, shutter mode + rate). Props: `attributeKey`, `modelValue`, `profile` (or a list of profiles for mixed targets, names grouped by model).
- [X] T019 [US2] Add a "Defaults" section to `src/stage/fixtures/dmx/DmxFixtureSettings.vue`: one row per supported attribute (from `getProfile`), showing the built-in default, an "override" toggle and an `AttributeValueEditor`. Writes `config.defaults` (FR-012). Depends on T017, T018.
- [X] T020 [US2] Make `src/programming/profile.ts` merge `config.defaults` into `profile.defaults` and invalidate on changes. Same-track overlap rule: in `processor.ts`, the later start wins via the priority tuple (FR-009). Check that releasing at the item end is immediate (FR-011). Depends on T017.
- [ ] T021 [US2] Run quickstart Q4–Q7 in both targets: layering, determinism on 5 positions (SC-004), the raw-vs-attribute priority swap, defaults override. Note the behavior change (track order instead of item array order, research R4) for the commit message.

**Checkpoint**: US1 + US2 make up the complete P1 foundation for programming DMX fixtures.

---

## Phase 5: User Story 3 - Groups with spatial ordering (Priority: P2)

**Goal**: Named, ordered fixture groups; per-item targets; default targets per track.

**Independent Test**: Quickstart Q8–Q9.

- [X] T022 [P] [US3] Add groups to the stage store in `src/stage/stage.ts`:
  - `groups: Ref<FixtureGroup[]>`, saved and loaded as `StageState.groups` (default `[]`)
  - actions `addGroup(name)` (name "non-empty, unique within the stage; duplicates get " (2)" on create"), `renameGroup`, `removeGroup`, `setGroupMembers` ("DMX fixtures only, no duplicates"), `setGroupOrdering`, `moveGroupMember`
  - a watch that removes deleted fixture ids from every group (FR-019; fixtures are deleted via `stage.fixtures.delete` in `src/stage/components/Fixtures.vue`)
- [X] T023 [P] [US3] Add `defaultTarget: Target | null` (default `null`) to `Track` and `ITrackState` in `src/timeline/model/track.ts`, and `target: Target | null` (default `null`), `fadeIn`, `fadeOut` (timeline units, "≥ 0", default `0`) to `Item` and `IItemState` in `src/timeline/model/item.ts`. Save and load them; missing fields load as defaults.
- [X] T024 [US3] Implement `src/programming/targets.ts`:
  - `resolveTarget(target): ResolvedTarget` per `contracts/engine.ts`
  - group order cached as a `computed` per group, modes per research R6: X ascending/descending, Z descending = front-to-back, Y, distance to the origin; world positions from `getWorldMatrix(scene, objectId)` of the linked visualization object; ties by manual order; fixtures without a scene object last
  - `normalizedIndex` 0 for a single fixture
  - warnings "Group not found", "Fixture not found", "Group is empty"
  - Depends on T022.
- [X] T025 [P] [US3] Create `src/programming/components/TargetSelect.vue`: a PrimeVue Select with option groups "Groups" and "Fixtures" (DMX only). Optional "Clip target" and "None" entries via props.
- [X] T026 [US3] Create `src/stage/components/Groups.vue` and add it to the Stage view next to Fixtures and Controllers (`src/views/Stage.vue`):
  - group list with add, rename and delete; deleting a group that items use asks for confirmation and states the number of uses
  - member multiselect
  - ordering select with the 8 modes
  - resolved order list, draggable in manual mode, with an icon for fixtures without a scene position (`contracts/programming-ui.md`)
  - Depends on T022, T024.
- [X] T027 [US3] Timeline UI:
  - a "Default target" `TargetSelect` in `src/timeline/components/TrackSettings.vue`
  - a "Target…" entry in the item context menu in `src/timeline/components/TimelineItem.vue` (for Graph items now; Look and Effect are added in their stories)
  - in `src/timeline/components/Timeline.vue`, where a dropped item gets its `trackId`, set `item.target = track.defaultTarget` (US3.4)
  - Depends on T023, T025.
- [X] T028 [US3] Extend the Attribute Output target select in `src/graph/nodes/output/AttributeOutputNode.ts` to "Clip target" (default for new nodes), groups and fixtures. In `src/programming/processor.ts`, resolve "clip" via `item.target` and groups via `resolveTarget`. Unresolved targets add the item warning and produce no output. Depends on T024, T014.
- [X] T029 [US3] Add the warning badge to `src/timeline/components/TimelineItem.vue`: an icon at the top right when `processor` warnings exist for the item; the tooltip lists them. Depends on T010.
- [ ] T030 [US3] Run quickstart Q8–Q9 in both targets.

**Checkpoint**: Groups and targets work with single-run graphs.

---

## Phase 6: User Story 4 - One graph drives a whole group (Priority: P2)

**Goal**: Graphs with a Fixture Input node are evaluated once per fixture of their target.

**Independent Test**: Quickstart Q10.

- [X] T031 [US4] Spike (timebox 2 h): measure `graph.editor.enginePlugin.runOnce` for a 20-node graph × 32 runs per frame in `src/timeline/baseTimelineProcessor.ts`. If it exceeds 10 ms, switch per-fixture runs to Baklava's `runGraph` with a topological order computed once per graph change. Record the result in research.md R7.
- [X] T032 [P] [US4] Add `fixture?: { index: number; normalizedIndex: number; position: Vec3 | null; groupSize: number; fixtureId: string }` to `ICalculationData` in `src/graph/types.ts`.
- [X] T033 [P] [US4] Create `src/graph/nodes/input/FixtureInputNode.ts` (type "Fixture Input"). Outputs: Index, Normalized Index, X, Y, Z, Has Position, Group Size, read from `globalValues.fixture`; defaults 0, 0, 0, 0, 0, false, 1. Export it from `src/graph/nodes/input/index.ts`. Depends on T032.
- [X] T034 [P] [US4] Create `src/graph/nodes/perFixtureState.ts`: `perFixtureState<T>(owner, ctx, init: () => T): T`, a `WeakMap<owner, Map<number, T>>` keyed by `ctx.globalValues.fixture?.index ?? 0`.
- [X] T035 [US4] Use `perFixtureState` for the instance state of `src/graph/nodes/effects/AfterglowNode.ts`, `src/graph/nodes/generators/ParticleNode.ts`, `src/graph/nodes/generators/NoiseNode.ts`, `src/graph/nodes/converters/AdsrNode.ts`, `src/graph/nodes/converters/TriggerNode.ts`, `src/graph/nodes/logic/SwitchNode.ts` and `src/graph/nodes/input/TrackInputNode.ts`. Behavior without a fixture context must stay identical. Depends on T034.
- [X] T036 [US4] Per-fixture runs in `src/timeline/baseTimelineProcessor.ts`:
  - If the graph contains a "Fixture Input" node, resolve all Attribute Output targets. If they differ, set `libraryItem.error = "Per-fixture graphs need one common target"` and skip the graph.
  - Otherwise run once per fixture with `calculationData.fixture` set. Each run's attribute results apply to that fixture only. Raw DMX and LED strip outputs are taken from the first run only.
  - Graphs without a Fixture Input run once.
  - Depends on T028, T031, T033, T035.
- [ ] T037 [US4] Run quickstart Q10 in both targets: wave, 9th head, stateful node without flicker, common-target error.

**Checkpoint**: Reusable group graphs.

---

## Phase 7: User Story 5 - Effect clips (Priority: P2)

**Goal**: Phaser-style effect clips, beat-synced, with spread, wings, blocks, interleave, relative/absolute mode and fades.

**Independent Test**: Quickstart Q11.

- [X] T038 [US5] Register the new library item types in one pass (also used by US6 and US7, so all three are added now):
  - `LOOK`, `EFFECT` and `PRESET` in the `LibraryItemType` enum, `LibraryItemTypeList`, labels ("Look", "Effect", "Preset") and icons (`mdi-lightbulb-group-outline`, `mdi-sine-wave`, `mdi-bookmark-outline`) in `src/library/libraryItem.ts`
  - type guards in `src/utils/libraryItemTypeGuards.ts`
  - `createItemByType` cases in `src/library/libraryModel.ts` (added as each class exists)
  - "create" menu entries in `src/library/Library.vue` (switch near line 86)
- [X] T039 [P] [US5] Implement `src/programming/effects.ts` (pure, research R8):
  - `phaseOffset(i, n, spread, wings, blocks, interleave, backward)` exactly per R8 steps 1–5
  - `evaluateShape(shape, t)` for sine, triangle, sawUp, sawDown, square (−1…1), circle (cos, sin) and figure8 (sin, sin 2x)
  - `evaluateEffect(effect, ctx): Contribution[]`: time `t = localPosition / (rateBeats·24) + offset/360`; absolute `base + size·shape`; relative offset `size·shape`; dimmer, zoom and focus remapped `(shape+1)/2`; color `lerpColor(colors[0], colors[1], (shape+1)/2)`, always absolute; panTilt writes both pan and tilt; fade weight `min(1, x/fadeIn, (L−x)/fadeOut)` with fades clamped to L/2, scaling the weight (absolute) or the size (relative); fixtures without the attribute skipped
- [X] T040 [US5] Create `src/programming/effect/Effect.libraryItem.ts` with the `EffectState` of data-model §7. Defaults: shape sine, mode relative, rateBeats 1, spread 360, wings/blocks/interleave 1, direction forward, size 0.5 or [20, 20], colors red/blue. Validation: "rateBeats > 0", "spread degrees 0..720", "integers ≥ 1"; circle/figure8 only with panTilt; color forces absolute. Add the `createItemByType` case. Depends on T038.
- [X] T041 [US5] Create `src/programming/effect/EffectEditor.vue`: fields per data-model §7, hiding fields that do not apply (`contracts/programming-ui.md`), plus a phase preview strip (one dot per fixture of the currently selected timeline item's target, animated with `evaluateShape` and `phaseOffset`). Register it in `src/components/UnifiedEditor.vue`. Depends on T039, T040.
- [X] T042 [P] [US5] Create `src/programming/effect/EffectPreview.vue` (a small shape icon plus the attribute name for the timeline item and library) and wire it where the existing previews are chosen (`src/timeline/components/TimelineItem.vue`, `src/library/LibraryItem.vue`). Give dropped effect items a default length of 4 beats (96 units) in `src/timeline/components/Timeline.vue`. Depends on T040.
- [X] T043 [US5] Add fade handles to `src/timeline/components/TimelineItem.vue` for Look and Effect items: draggable triangles at the top-left and top-right corners that edit `item.fadeIn` / `item.fadeOut` (≥ 0, at most length/2, grid snapping like item moves) and draw a diagonal overlay. Add the "Target…" context entry for Effect and Look items. Depends on T023.
- [X] T044 [US5] Evaluate effect items in `src/programming/processor.ts`: for active `EFFECT` items, build an `ItemContext` (`localPosition = unit − start`, length, fades, `resolveTarget(item.target)`) and add `evaluateEffect` contributions. Depends on T039, T040, T024.
- [ ] T045 [US5] Run quickstart Q11 in both targets, including the BPM change and SC-003 timing (< 2 min).

**Checkpoint**: Effects usable on their own; with US1–US4, everyday moving-head programming is covered.

---

## Phase 8: User Story 6 - Look clips with fades (Priority: P3)

**Goal**: Static looks with single or fanned values, crossfades and fan timing.

**Independent Test**: Quickstart Q12.

- [X] T046 [P] [US6] Implement `src/programming/looks.ts` (pure; preset and aim lookups are injected as functions):
  - `resolveLookValue(look, key, fixture, n, lookups)` in the order of data-model §6: perFixture → preset (per-fixture, then common, else unset) → fan `lerp(from, to, p)` with `p = i/(n−1)`, mirrored `p = 1 − |2i/(n−1) − 1|` → single → aim
  - `evaluateLook(look, ctx): Contribution[]` with the fade weight `min(1, x/fadeIn, (L−x)/fadeOut)` (fades clamped to L/2) and fan timing: per fixture the fade lasts `F·(1−f)` and starts after `F·f·p_i` (research R9)
  - discrete attributes switch at the fixture's own `w ≥ 0.5` (the engine handles this)
- [X] T047 [US6] Create `src/programming/look/Look.libraryItem.ts` with the `LookState` of data-model §6: values, `fanTiming` "0..1, default 0", `perFixture` "default {}". Validation: "fan" only for continuous attributes; an "aim" value only under key "pan" and it removes "tilt". Add the `createItemByType` case. Depends on T038.
- [X] T048 [US6] Create `src/programming/look/LookEditor.vue` per `contracts/programming-ui.md`: an "Add attribute" menu; rows with a value-kind select (Single / Fan / Preset / Aim, where Preset and Aim show "coming with presets / aim targets" until US7/US8 add them); `AttributeValueEditor` for values (slot names from the profiles of the selected item's target); a fan timing slider. Register it in `src/components/UnifiedEditor.vue`. Depends on T018, T047.
- [X] T049 [P] [US6] Create `src/programming/look/LookPreview.vue` (color swatch plus attribute count) and wire it into `TimelineItem.vue` and `LibraryItem.vue`. Default dropped length 4 beats in `src/timeline/components/Timeline.vue`. Depends on T047.
- [X] T050 [US6] Evaluate look items in `src/programming/processor.ts` like effects (T044), using `evaluateLook`. Depends on T046, T047.
- [ ] T051 [US6] Run quickstart Q12 in both targets: interpolation without a dark color midpoint, gobo switch at mid-fade, fan timing ending at the same time.

**Checkpoint**: Classic cue-style programming available.

---

## Phase 9: User Story 7 - Presets (Priority: P3)

**Goal**: Position, color and beam presets that looks reference.

**Independent Test**: Quickstart Q13.

- [X] T052 [US7] Create `src/programming/preset/Preset.libraryItem.ts` with the `PresetState` of data-model §8: `presetKind` (fixed after creation), `common`, `perFixture`, `aimTargetId` (position only, default null). Enforce the allowed keys per kind (research R10): position = pan, tilt; color = color, colorWheel, colorTemperature, colorMacro; beam = goboWheel, goboRotation, prism, prismRotation, zoom, focus, shutter. Add the `createItemByType` case and a creation sub-menu "Position / Color / Beam preset" in `src/library/Library.vue`. Depends on T038.
- [X] T053 [US7] Create `src/programming/preset/PresetEditor.vue`: common values (`AttributeValueEditor`, allowed keys only), a per-fixture table (add fixture via `TargetSelect` limited to fixtures, edit values, remove), and a read-only uses count. Register it in `src/components/UnifiedEditor.vue`. Depends on T052, T018.
- [X] T054 [US7] Enable the "Preset" value kind in `src/programming/look/LookEditor.vue` (a select of presets of the matching kind) and inject the preset lookup into `evaluateLook` in `src/programming/processor.ts`. A dangling `presetId` leaves the attribute unset with the warning "Preset not found". Depends on T046, T052.
- [X] T055 [US7] Bake on delete: in `src/library/libraryModel.ts` `removeItem`, for a `PRESET` that looks reference, show a ConfirmDialog in `src/library/LibraryItem.vue` and `Library.vue` ("Used by n looks"). On confirm, replace each reference with the preset's values: common value → `{ kind: "single" }`; per-fixture values → the look's `perFixture` map (research R10). Depends on T052, T047.
- [ ] T056 [US7] Run quickstart Q13 in both targets (SC-007).

**Checkpoint**: Presets usable.

---

## Phase 10: User Story 8 - Aim at targets in the 3D scene (Priority: P3)

**Goal**: Named aim targets in the scene; looks and position presets aim heads at them.

**Independent Test**: Quickstart Q14.

- [X] T057 [P] [US8] Add the scene object kind `aimTarget` (`SceneObjectBase<"aimTarget">`) to `src/scene/model/types.ts` (type, `isAimTarget` guard, `KNOWN_KINDS`) and to `src/scene/model/sanitize.ts` (base-field rules only). Make `src/visualization/sceneView.ts` and `src/visualization/objectBuilders.ts` skip it in the show window and build a crosshair gizmo (three `LineSegments`, 0.3 m, editor view only, like labels).
- [X] T058 [P] [US8] Implement `src/programming/aim.ts` (pure, research R11), exported as `aimAt(fixtureWorld, target, model, ranges): AimResult`:
  - Transform the target into the model frame (inverse world matrix including `modelScale`).
  - Pan = atan2 in the plane perpendicular to the pan axis; tilt = angle from the rest beam after pan.
  - Check both solutions `(pan, tilt)` and `(pan ± 180°, −tilt)` against the ranges; choose the reachable one with |pan| closest to 0, else clamp the better one with `reachable: false`.
  - Model defaults: pan axis Y, tilt axis X, beam +Y.
- [X] T059 [US8] Verify the rest-pose assumption of R11 for every moving-head model in `src/assetLibrary/catalog/` (pan and tilt node rest quaternion = identity, tilt node a child of the pan node). Document exceptions and handle them via an optional `restRotation` in `aim.ts`. Depends on T058.
- [X] T060 [US8] Scene editor integration:
  - "Aim target" in the add menu (`src/scene/editor/EditorToolbar.vue` or the existing add menu), placed at the camera target on the floor and named "Target n"
  - a crosshair icon in `src/scene/editor/Outliner.vue`
  - when deleting a target that is in use, extend the existing delete confirm with "Used by n looks/presets"
  - Depends on T057.
- [X] T061 [US8] Wire aiming:
  - In `src/programming/processor.ts`, inject an aim lookup into `evaluateLook`: world matrix from `getWorldMatrix` of the fixture's visualization object; model axes and beam from `fixtureModelOf(modelId)?.fixture` (movingParts, beam); ranges from the profile.
  - Unreachable → clamped plus the warning "<fixture>: target out of range". Missing target or no scene position → pan/tilt unset plus a warning (FR-035).
  - Enable the "Aim" value kind (pan row; it hides tilt) in `LookEditor.vue` and "Aim at target" in `PresetEditor.vue`, using the preset's `aimTargetId` in `resolveLookValue`.
  - Depends on T046, T052, T057, T058.
- [ ] T062 [US8] Run quickstart Q14 in both targets (SC-008, ≤ 0.1 m).

**Checkpoint**: All user stories complete.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [X] T063 [P] Implement `src/programming/debug.ts`: `programming.debug()` on `window` (like `window.processor`) prints per-frame timings (graph runs, merge and encode) and the attribute values plus DMX output of a selected fixture. Add timing hooks in `baseTimelineProcessor.ts` and `processor.ts`.
- [X] T064 Performance pass (quickstart Q15, SC-005): 32 heads, a per-fixture graph, an effect and a look at 30 fps; graphs ≤ 10 ms, engine ≤ 2 ms. Optimize the hot paths found (profile caching, allocation in `engine.ts`/`encode.ts`, group order caching).
- [ ] T065 Persistence round trip (quickstart Q16): save and reload groups, defaults, track/item targets, fades, looks, effects, presets and aim targets; playback identical at the Q5 positions. Load a project from before this feature: no errors.
- [ ] T066 Build the test rig `specs/004-dmx-attribute-programming/test-rig.lmp` described in quickstart.md "Prerequisites" and run the spec's 10-step manual verification in the desktop and browser builds. Hardware step (Q17) desktop only.
- [X] T067 [P] Update the README feature list if it mentions programming features, and set the spec status in `specs/004-dmx-attribute-programming/spec.md` to "Implemented".
- [X] T068 Final quality gates: `pnpm lint` and `pnpm build`. The commit message must mention the behavior change "overlapping graphs on the same DMX fixture are now ordered by track (lowest track wins) instead of item order" (constitution IV, research R4).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup. Blocks all stories.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: after Foundational; uses the US1 node for verification (Q4).
- **US3 (Phase 5)**: after US1 (T028 extends the Attribute Output node).
- **US4 (Phase 6)**: after US3 (needs resolved group targets).
- **US5 (Phase 7)**: after US3 (targets, item fields). Independent of US4.
- **US6 (Phase 8)**: after US3 and T038/T043 from US5 (library types, fade handles).
- **US7 (Phase 9)**: after US6 (looks reference presets).
- **US8 (Phase 10)**: after US6 (aim values in looks). T057 and T058 can start any time after Foundational.
- **Polish (Phase 11)**: after the desired stories.

### Story Dependency Graph

```
Setup → Foundational → US1 → US2
                        └──→ US3 ─┬→ US4
                                  ├→ US5 ─→ US6 ─┬→ US7
                                  │              └→ US8
```

### Within Each Story

Pure modules before stores and library items, those before editors and UI, processor wiring last, then the quickstart run.

### Parallel Opportunities

- Phase 1: T002 in parallel with T001.
- Phase 2: T004, T005 and T006 in parallel. T007 and T008 after T004. T009–T011 sequential.
- US2: T017 and T018 in parallel.
- US3: T022, T023 and T025 in parallel.
- US4: T032, T033 and T034 in parallel, while T031 (spike) runs.
- US5: T039 and T042 in parallel with T040.
- US6: T046 and T049 in parallel.
- US8: T057 and T058 in parallel, startable early.
- US4 and US5 can proceed in parallel after US3.

---

## Parallel Example: Foundational

```text
Task: "T004 Implement src/programming/attributes.ts"
Task: "T005 Implement src/programming/color.ts"
Task: "T006 Add shared types to src/programming/types.ts"
```

## Parallel Example: User Story 4

```text
Task: "T031 Spike runOnce cost (baseTimelineProcessor.ts)"
Task: "T032 Add ICalculationData.fixture in src/graph/types.ts"
Task: "T034 Create src/graph/nodes/perFixtureState.ts"
```

## Parallel Example: User Story 8

```text
Task: "T057 aimTarget scene kind in src/scene/model/types.ts + sanitize.ts"
Task: "T058 Implement src/programming/aim.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) and Phase 2 (Foundational), then check that old projects are unchanged (T012).
2. Phase 3 (US1): attribute programming of single fixtures.
3. **Stop and validate** with Q1–Q3, then commit to `main`.

### Incremental Delivery

1. Add US2 (layering, defaults), completing P1. Commit with the behavior-change note.
2. Add US3, US4 and US5 (groups, group graphs, effects), completing P2. Commit after each story.
3. Add US6, US7 and US8 (looks, presets, aiming), completing P3.
4. Polish: performance, persistence, full manual verification.

Each story is committed after its quickstart scenarios pass and `pnpm lint` / `pnpm build` are green.

---

## Notes

- [P] tasks touch different files and have no dependency on incomplete tasks.
- Constraint quotes in task descriptions come from data-model.md; follow them exactly.
- Pure modules in `src/programming` (attributes, color, encode, engine, effects, looks, aim) must not import Vue, Pinia or stores.
- `src/visualization` must not import `src/programming` or stores.
- Commit after each story checkpoint, directly to `main` (project convention).
