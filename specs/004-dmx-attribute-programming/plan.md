# Implementation Plan: Attribute-Based DMX Fixture Programming

**Branch**: `004-dmx-attribute-programming` (feature directory; work is committed directly to `main` per project convention) | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-dmx-attribute-programming/spec.md`

## Summary

Make classic DMX fixtures programmable by **attributes** instead of raw channels, and let sources **layer per attribute**:

- **Attribute model and encoder** (R1–R3): about 15 semantic attributes (dimmer, shutter, pan/tilt in degrees, color, wheels by slot, zoom, focus, …) on top of feature 003's capability mapping. The encoder is the exact inverse of 003's decoder: 16-bit, color mixing (RGB/RGBW/CMY) or the closest color-wheel slot in OKLab. Programming uses the linked visualization's mapping, or an auto-generated one for fixtures without a scene object (R2, FR-002 reworded).
- **Merge engine** (R4): a new stateless per-frame engine replaces whole-fixture last-writer-wins for DMX fixtures. Contributions are folded per attribute by priority (track index, then item start), with weights for fades, relative offsets for effects and raw channels at channel level. Defaults come from per-fixture overrides and built-in values. LED strips, other fixture types and scripts keep their current path.
- **Groups and targets** (R5, R6): groups live in the stage, with manual or scene-derived order. Timeline items get `target`, `fadeIn` and `fadeOut`; tracks get `defaultTarget`.
- **Per-fixture graphs** (R7): an Attribute Output node plus a Fixture Input node. Graphs with a Fixture Input run once per fixture of their common target. 7 stateful nodes keep their state per fixture.
- **New library items** (R8–R10): Effect (phaser: shapes, beat rate, spread, wings, blocks, interleave, relative/absolute), Look (single, fan, preset or aim values, fades, fan timing) and Preset (position, color, beam; referenced, baked on delete).
- **Aim targets** (R11): a new scene object kind with analytic inverse kinematics from the model contract of feature 002.
- No new dependency. No Rust, WASM or bridge change. Saved state changes are additive (R14).

## Technical Context

**Language/Version**: TypeScript 5.8, Vue 3.5 (Composition API, `<script setup>`)

**Primary Dependencies**:
- BaklavaJS 2.6: graph engine, two new nodes, per-fixture runs.
- Pinia 3: stage, timeline and library stores.
- PrimeVue 4: editors and panels.
- three 0.176: only `Matrix4` / `Vector3` math via `scene/model/transformMath.ts`, for ordering and inverse kinematics.

All are already installed (R15).

**Storage**: project file (`SavedState`) with additive fields:
- `stage.groups`
- `DmxFixtureConfiguration.defaults`
- `ITrackState.defaultTarget`
- `IItemState.target`, `fadeIn`, `fadeOut`
- library states for `LOOK`, `EFFECT` and `PRESET`
- scene objects of kind `aimTarget`

See [contracts/project-state-delta.ts](./contracts/project-state-delta.ts). No user preferences.

**Testing**: no automated tests required (constitution III). The pure modules (`encode.ts`, `effects.ts`, `looks.ts` value math, `aim.ts`, `engine.ts` fold) are good candidates for optional unit tests later; no test runner is added. Manual verification follows [quickstart.md](./quickstart.md) (Q1–Q17) and the spec's 10-step procedure, in both targets. Quality gates: `pnpm lint` and `pnpm build`.

**Target Platform**: Electron 36 desktop app and the browser build (GitHub Pages). DMX hardware output only where controllers exist today (desktop bridge).

**Project Type**: desktop/web single-page application (one Vite project).

**Performance Goals**: SC-005: 32 heads, one per-fixture graph over all of them, one effect and one look, at the project frame rate (default 30 fps). Budget per frame: graph runs ≤ 10 ms, merge and encode ≤ 2 ms (R12).

**Constraints**:
- Both targets (FR-037, constitution I).
- Stateless output (FR-011): no history in the engine; effect phase from the timeline position.
- `src/visualization` must stay free of store and editor imports (rule from 001–003). The new code lives in `src/programming`, which may import stores. Its pure submodules must not.
- The show window protocol is unchanged (still v3): aim targets are editor-only, and fixture values flow as before.

**Scale/Scope**:
- About 12 new TS modules in `src/programming`.
- 2 new graph nodes and 7 stateful nodes adapted.
- 3 new library item types (each with item class, editor and preview).
- About 6 new Vue components (Groups panel, fixture defaults, look/effect/preset editors, target select).
- About 15 changed files (timeline model and UI, processor, stage, scene model and editor, autoMap/keys for `focus`, `UnifiedEditor`, library).

**Open items (not blocking)**:
- Whether per-fixture graph runs need the precomputed-order path instead of `runOnce` is decided by a spike in the first P2 task (R7).
- The rest-pose assumption of moving-head models is verified per catalog model in the aim task (R11).

All technical unknowns are resolved in [research.md](./research.md) (R1–R15). No NEEDS CLARIFICATION items remain.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| **I. Two targets, one codebase** | Pure TypeScript logic and Vue UI, identical in Electron and the browser. No runtime checks or Electron calls. Output goes through existing fixtures and controllers, so the hardware path is unchanged. The browser build stays the CI target. | ✅ Pass |
| **II. Typed boundaries & quality gates** | Attributes, contributions, saved state and UI are typed ([contracts/](./contracts/)). The untyped `Track.data` is not used for new data; typed fields are added. No Rust or bridge change, so there are no bindings to regenerate. The generated `open-fixture.ts` is not edited. `pnpm lint` and `pnpm build` are done criteria. | ✅ Pass |
| **III. Manual verification** | The spec has a 10-step procedure. quickstart.md expands it to 17 scenarios with expected results and timing measurements (SC-001, SC-003, SC-005), in both targets (hardware step desktop only). | ✅ Pass |
| **IV. Free iteration before 1.0** | All saved-state changes are additive, so old projects load. One behavior change: overlapping graphs on the same DMX fixture are now ordered by track instead of item array order (R4). It must be stated in the commit message. | ✅ Pass |
| **V. Simplicity first** | No new dependency (R15). The mapping stays where it is instead of being migrated (R2). The existing graph engine runs per fixture instead of vectorizing nodes (R7). Looks, effects and presets reuse the library machinery (R10). No worker or WASM engine (R12). No programmer view, tracking or HTP. The added machinery (merge engine, three library types, inverse kinematics) is what the spec requires; see Complexity Tracking. | ✅ Pass (see Complexity Tracking) |

**Post-design re-check (after Phase 1)**: still passes.
- **Module boundaries**: `src/programming/{attributes,encode,color,effects,looks,aim,engine}.ts` are pure: they import only types, `transformMath` and feature 003's capability types and decoders. `profile.ts` and `targets.ts` read stores. `processor.ts` connects them to `BaseTimelineProcessor`. `src/visualization` gets only the `focus` key (keys/autoMap) and no store import.
- **Timeline processor**: `applyGraphResults` keeps handling non-DMX fixtures. DMX results become contributions. The `uncontrolledFixtures` reset applies to non-DMX fixtures only, because DMX fixtures always get the merged frame (defaults included).
- **Scene**: one new known kind (`aimTarget`) with base-field sanitizing, added through the existing `runCommand` machinery. The show window ignores it.

## Project Structure

### Documentation (this feature)

```text
specs/004-dmx-attribute-programming/
├── plan.md              # This file
├── research.md          # Phase 0 (R1–R15)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 (Q1–Q17)
├── contracts/
│   ├── attributes.ts            # attribute model, profile, encoder API
│   ├── engine.ts                # targets, contributions, merge, sources, aim API
│   ├── project-state-delta.ts   # saved-state additions
│   └── programming-ui.md        # nodes, panels, editors, timeline UI
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── programming/                     # NEW
│   ├── index.ts
│   ├── attributes.ts                # ATTRIBUTES, BUILT_IN_DEFAULTS, validation (pure)
│   ├── color.ts                     # OKLab, linear RGB lerp, Kelvin→RGB reuse (pure)
│   ├── encode.ts                    # attribute set → Uint8Array, inverse of capabilities/decode.ts (pure)
│   ├── profile.ts                   # mapping resolution (R2), FixtureProfile cache (stores)
│   ├── targets.ts                   # group order, ResolveTarget (stores + transformMath)
│   ├── engine.ts                    # MergeFrame fold (pure)
│   ├── effects.ts                   # phase, shapes, EvaluateEffect (pure)
│   ├── looks.ts                     # value resolution, fades, fan timing, EvaluateLook (pure + preset lookup injected)
│   ├── aim.ts                       # inverse kinematics (pure)
│   ├── processor.ts                 # builds contributions from active items, calls engine, applies values
│   ├── debug.ts                     # programming.debug() timings
│   ├── look/      Look.libraryItem.ts, LookEditor.vue, LookPreview.vue
│   ├── effect/    Effect.libraryItem.ts, EffectEditor.vue, EffectPreview.vue
│   ├── preset/    Preset.libraryItem.ts, PresetEditor.vue
│   └── components/ TargetSelect.vue, AttributeValueEditor.vue
├── graph/
│   ├── types.ts                     # ICalculationData.fixture
│   ├── nodes/output/AttributeOutputNode.ts   # NEW
│   ├── nodes/input/FixtureInputNode.ts       # NEW
│   ├── nodes/perFixtureState.ts              # NEW helper
│   └── nodes/{effects/Afterglow,generators/Particle,generators/Noise,converters/Adsr,converters/Trigger,logic/Switch,input/TrackInput}Node.ts  # per-fixture state
├── timeline/
│   ├── baseTimelineProcessor.ts     # per-fixture graph runs, hand-off to programming/processor
│   ├── model/track.ts, item.ts      # defaultTarget, target, fadeIn/fadeOut
│   └── components/TimelineItem.vue, TrackSettings.vue   # fade handles, badges, target selects
├── stage/
│   ├── stage.ts                     # groups state + actions, fixture removal cleanup
│   ├── components/Groups.vue        # NEW
│   └── fixtures/dmx/dmx.fixture.ts, DmxFixtureSettings.vue  # defaults
├── scene/
│   ├── model/types.ts, sanitize.ts  # aimTarget kind
│   └── editor/…                     # add menu, gizmo, outliner icon
├── visualization/capabilities/keys.ts, types.ts, autoMap.ts   # "focus" key
├── library/libraryItem.ts, libraryModel.ts                     # LOOK, EFFECT, PRESET
└── components/UnifiedEditor.vue                                # new editors
```

**Structure Decision**: one new top-level module, `src/programming`, holds the attribute model, the engine and the new library item types, matching how `src/graph`, `src/automation` and `src/pattern` each own their domain. Changes outside it are integration points in existing modules.

## Implementation Phases (input for /speckit-tasks)

1. **P1 foundation** (US1, US2):
   - `focus` key
   - attributes, color, encode, profile
   - engine and processor integration (DMX path), track-order priority
   - Attribute Output node (fixture/group target, single run)
   - per-fixture defaults UI
   - checks: Q1–Q7
2. **P2a groups and targets** (US3):
   - stage groups, Groups panel, `targets.ts`
   - track and item target fields, UI
   - checks: Q8–Q9
3. **P2b per-fixture graphs** (US4):
   - spike for `runOnce` cost
   - Fixture Input, per-fixture runs, `perFixtureState` in 7 nodes
   - check: Q10
4. **P2c effects** (US5):
   - Effect library item, editor and preview, `effects.ts`, fade handles
   - check: Q11
5. **P3a looks and presets** (US6, US7):
   - Look and Preset library items, `looks.ts`, fan timing, bake on delete
   - checks: Q12–Q13
6. **P3b aim targets** (US8):
   - scene kind, gizmo, `aim.ts`, model rest-pose verification
   - check: Q14
7. **Polish**:
   - performance pass (Q15), persistence round trip (Q16), hardware (Q17)
   - debug helper; commit note about the priority behavior change

## Complexity Tracking

| Added complexity | Why needed | Simpler alternative rejected because |
|---|---|---|
| New merge engine beside the existing graph-result path | Per-attribute layering, fades and relative effects (FR-009–FR-011, FR-024, FR-028) are impossible with whole-fixture last-writer-wins. | Merging per channel only cannot interpolate or offset semantic values. Replacing the path for all fixture types would touch working LED code (FR-015). |
| Three new library item types | Looks, effects and presets are separate user concepts with different editors (US5–US7). | One generic "programming clip" type would need a mode switch in every editor and save format, which is more complex for the same features. |
| Per-fixture state in 7 graph nodes | Running a graph N times per frame would otherwise mix the state of different fixtures (R7). | Cloning graphs per fixture costs memory and complicates editing. Vectorizing all nodes means rewriting the node set. |
| Inverse kinematics module | FR-033–FR-035 (aim targets). | Numeric solving against Three.js fixture bodies would break the module rule and be slower. |
