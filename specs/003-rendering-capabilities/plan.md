# Implementation Plan: Rendering & Fixture Capability Upgrades

**Branch**: `003-rendering-capabilities` (feature directory; work is committed directly to `main` per project convention) | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-rendering-capabilities/spec.md`

## Summary

Make the 3D preview show what fixtures actually do. Building on the scene editor (001) and the fixture model contract (002):

- **One capability mapping for every DMX visualization**, generated automatically from the Open Fixture Library definition of the selected mode (research R2, R3). It covers pan/tilt with 16-bit fine channels, dimmer, shutter/strobe segments, RGB/RGBW/RGBA/CMY and the other color channels, color temperature, color macros, color and gobo wheels (slot colors and embedded gobo SVGs copied into the config), zoom with angle ranges, prism, per-cell pixel channels and the special-effect channels. Manual corrections are kept until the user runs Auto-Assign again.
- **Decoding happens in each view**, per frame, from raw DMX bytes (R1). Strobe gates are refresh-safe and photosensitivity-limited (R5), pan/tilt, zoom and wheels move at a realistic speed (R6), and the color pipeline handles all mixing models (R4).
- **One `BeamRenderer`** replaces the spot and moving head renderers (R4). The volumetric beam gains haze, prism instancing, gobo and split colors, and is cut off at the first hit (R8, R11).
- **Our own surface lighting** replaces Three.js SpotLights (R7). One per-view light list in data textures is evaluated inside the LED-lit material every surface already uses. It covers gobo projection from one atlas, prism, LED strip segment lights and the lower-priority tiers (FR-023), plus a shadow atlas at high quality (R11). The number of lights no longer changes programs or uses up texture units.
- **LED strips**: freeform paths drawn on surfaces (R17), every pixel shown as a point at the real pixel count, and surface light from LOD segments with no strip limit (R10). Multi-cell fixtures drive each model emitter (`FixtureBody.setCellColors`).
- **Special effects**: five new visualization types (Laser, Flame, CO2 Jet, Cold Spark, Fog/Haze) on a small shared CPU particle core. Strobes and blinders run on the extended Generic Fixture (R14).
- **Environment and performance**:
  - Haze and hazer coupling, plus ambient presets per view, all stored in the project (R13).
  - Quality levels per view and user, and an FPS HUD, stored in localStorage and synced across windows (R12, R16, R18).
  - Inactive views stop rendering. Fixture values go only to active sinks, once per frame, as `Uint8Array`, over show-window protocol v3 (R15).
- No new dependency. No Rust, WASM or bridge change. Old projects load through sanitize conversion rules (no breaking change).

## Technical Context

**Language/Version**: TypeScript 5.8, Vue 3.5 (Composition API, `<script setup>`), GLSL ES 3.0 (WebGL2 shaders via Three.js)

**Primary Dependencies**:
- three 0.176: core, `EffectComposer`, `ExtrudeGeometry`, `CatmullRomCurve3`, `InstancedBufferGeometry`, render targets.
- three-custom-shader-material, for the LED-lit material that becomes the surface-lighting material.
- Pinia 3, PrimeVue 4 (Select, InputNumber, Slider, Checkbox, Popover, ConfirmPopup, DataTable), @vueuse/core.

All are already installed (R19).

**Storage**:
- **Project** (`SavedState.stage.scene`, `formatVersion` stays 1): capability mappings, wheels, cells, movement and effect options in the fixture visualization configs; LED strip paths; `scene.environment` (haze, coupling, ambient per view).
- **Per user**: `localStorage["lms.viewPreferences"]` (quality per view, FPS overlay, flash limit).

**Testing**: no automated tests required (constitution III). The pure decoders in `src/visualization/capabilities/` are candidates for optional unit tests later. No test runner is added by this plan. Manual verification follows [quickstart.md](./quickstart.md) (Q1–Q23) and the spec's 9-step procedure, in both targets. Quality gates: `pnpm lint` and `pnpm build`.

**Target Platform**: Electron 36 desktop app and the browser build (GitHub Pages), WebGL2. Gracefully degrades on devices without float render targets or with few texture units (FR-055).

**Project Type**: desktop/web single-page application. One Vite project with the entries `index.html` and `visualization.html` (plus the dev-only `asset-workbench.html` from 002).

**Performance Goals**:
- SC-002: the reference scene (40 moving heads, 20 pars, 10 pixel bars, 4 lasers, 2 hazers, 20 × 300-pixel strips, haze 50 %) at ≥ 50 fps, Medium quality, show window, on the developer machine.
- SC-003: the same scene at ≥ 30 fps on Low on an integrated-graphics laptop.
- SC-004: a value change becomes visible within 2 frames.
- SC-006: no load while no view is visible.

**Constraints**:
- Both targets (FR-070, constitution I).
- `src/visualization` and `src/assetLibrary` must not import stores or editor code (rule from 001/002).
- Program recompiles only on quality changes (R7).
- Fixed texture-unit cost: at most 4 extra units per material.
- The show window has no fixture library, so everything the renderer needs must be in the config (R9).

**Scale/Scope**:
- About 9 visualization types (5 new) and about 30 new TS modules: capabilities (8), lighting (6), effects (7), quality/preferences/environment/HUD (4), strip path and tool (3).
- About 6 new Vue components (mapping editor, environment and display popovers, HUD, show-window settings, effect settings) and about 20 changed files.

**Open items (not blocking)**: the final quality profile numbers are tuned against SC-002/SC-003 during implementation (R12 gives the starting values). The `reference-scene.lmp` test project is built in the first performance pass.

All technical unknowns are resolved in [research.md](./research.md) (R1–R19). There are no NEEDS CLARIFICATION items left.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| **I. Two targets, one codebase** | Everything is WebGL2, browser APIs (canvas SVG rasterizing, IntersectionObserver, BroadcastChannel, localStorage) and Three.js, identical in Electron and the browser. No runtime checks or Electron calls in feature code. Device limits degrade per feature with a notice (FR-055) instead of crashing. The browser build stays the CI target. | ✅ Pass |
| **II. Typed boundaries & quality gates** | Mapping, configs, environment, protocol v3 and renderer API are typed ([contracts/](./contracts/)). The protocol version is bumped to 3, so mismatched show windows ask for a reload. The generated `open-fixture.ts` is not edited: the export's object-form `resource` is handled by a type guard (R9). No Rust or bridge changes, so there are no bindings to regenerate. `pnpm lint` and `pnpm build` are done criteria. | ✅ Pass |
| **III. Manual verification** | The spec has a 9-step procedure. quickstart.md maps it to 23 scenarios with expected results, frame-rate recording and an SC-001 checklist, in both targets (hardware step only in desktop). | ✅ Pass |
| **IV. Free iteration before 1.0** | Format changes are additive (`environment`, new types) or converted on load (old mapping, spot, generic and strip configs, data-model §8). Old projects keep loading, so no breaking-change notice is needed. Protocol v2 → v3 is an allowed internal change. If implementation drops a load rule, the commit message must say so. | ✅ Pass |
| **V. Simplicity first** | No new dependency (R19). One beam renderer instead of two (R4), one mapping format and editor instead of one per type (R2), and one shared particle core for all effects (R14). Preferences use localStorage, not a native adapter extension (R16). No deferred or clustered renderer, no ray-marched fog, no test runner. The extra machinery (custom surface lighting, shadow atlas, five effect types) is justified in Complexity Tracking. | ✅ Pass (see Complexity Tracking) |

**Post-design re-check (after Phase 1)**: still passes.
- **Module boundaries**: the design adds four folders under `src/visualization` (`capabilities/`, `lighting/`, `fixtureVisualizations/beam/`, `fixtureVisualizations/effects/`) and three small modules (`quality.ts`, `viewPreferences.ts`, `environment.ts`). Editor-only pieces (strip tool, popovers) live in `src/scene/editor`. The dependency rule holds: `capabilities/` imports only OFL types and asset-catalog types, and `lighting/` imports only three.
- **Store**: the scene store gets two commands (`setEnvironment`, `setStripPath`) on the existing `runCommand` and preview/commit machinery.
- **Existing bug**: the `null`-channel index bug in `DmxFixture.channelNames` (R3) is fixed as part of this feature, because auto-mapping depends on correct indices. It shifts channel numbers for fixtures whose modes contain `null`, which is a behavior fix, not a format break. It is mentioned in the commit message.

## Project Structure

### Documentation (this feature)

```text
specs/003-rendering-capabilities/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R19
├── data-model.md        # Phase 1: mapping, configs, environment, runtime state, load rules
├── quickstart.md        # Phase 1: run, gates, validation scenarios Q1–Q23
├── contracts/
│   ├── capability-mapping.ts       # CapabilityMapping, segments, wheels, cells, auto-map API
│   ├── scene-state-delta.ts        # environment, new visualization types, per-type configs, catalog delta
│   ├── show-window-protocol-v3.md  # lifetime/heartbeat, Uint8Array values, environment, active gating
│   ├── renderer-api.ts             # SceneView, SurfaceLighting, quality/preferences, decoded states, FixtureBody delta
│   └── rendering-ui.md             # mapping editor, environment/display popovers, HUD, strip drawing tool
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── visualization/
│   ├── capabilities/                       # NEW: pure, shared by both windows (R1–R6)
│   │   ├── types.ts                        # = contracts/capability-mapping.ts
│   │   ├── keys.ts                         # KEYS_BY_TYPE, defaults, units (data-model §1)
│   │   ├── oflResolve.ts                   # mode channels (null, fine, matrix), entity parsing, resource guard
│   │   ├── autoMap.ts                      # OFL definition + mode → CapabilityMapping (R3)
│   │   ├── decode.ts                       # readDmx (8/16-bit), segment lookup, scalar decode
│   │   ├── colorMath.ts                    # additive/subtractive mix, Kelvin, hex
│   │   ├── strobe.ts                       # shutter gate, flash limit, refresh-safe (R5)
│   │   ├── movement.ts                     # velocity/acceleration follower (R6)
│   │   ├── beamState.ts / cellState.ts / effectState.ts
│   │   └── sanitizeMapping.ts              # repair rules used by scene sanitize (data-model §8.6)
│   ├── lighting/                           # NEW (R7, R10, R11)
│   │   ├── surfaceLighting.ts              # replaces LedStripLighting
│   │   ├── lightPriority.ts                # scoring, tiers, hysteresis (FR-023)
│   │   ├── goboAtlas.ts                    # SVG rasterizing, generic patterns (R9)
│   │   ├── shadowAtlas.ts                  # depth tiles for top lights (high)
│   │   └── shaders/surfaceLighting.{vert,frag}  # replace shaders/modifiedStandardMaterial.*
│   ├── ledLitMaterial.ts                   # CHANGED: uses SurfaceLighting uniforms/defines
│   ├── quality.ts                          # NEW: profiles, device support, fallback notices (R12)
│   ├── viewPreferences.ts                  # NEW: localStorage + storage event (R16)
│   ├── environment.ts                      # NEW: ambient presets, effective haze (R13)
│   ├── ViewHud.vue                         # NEW: FPS + notices (R18)
│   ├── sceneView.ts                        # CHANGED: active state, per-frame values, FrameContext, quality,
│   │                                       #   environment, raycastSurfaces, resolution-aware bloom; light budget removed
│   ├── bloom.ts                            # CHANGED: resolution follows the view, mip count from quality
│   ├── protocol.ts                         # CHANGED: v3 (heartbeat, bye, environmentChanged, Uint8Array values)
│   ├── showWindowClient.ts                 # CHANGED: heartbeat/bye/visibility, environment
│   ├── StageView.vue                       # CHANGED: HUD, gear menu (quality, FPS, flash limit)
│   ├── visualizationServer.ts              # CHANGED: Uint8Array conversion, active-sink gating, full state on activation
│   ├── fixtureVisualization.ts             # CHANGED: 5 new VisualizationTypes
│   └── fixtureVisualizations/
│       ├── base.renderer.ts                # CHANGED: update(frame), Uint8Array values, getSurfaceLight removed
│       ├── factory.ts                      # CHANGED: new types; Spot/Moving Head → BeamRenderer
│       ├── CapabilityMappingEditor.vue     # NEW: replaces ChannelMapping.vue usage (rendering-ui.md)
│       ├── beam/                           # NEW: beam.renderer.ts, beam.vertex/fragment.glsl (moved + extended), types.ts,
│       │                                   #   BeamVisualizationSettings.vue
│       ├── movingHead/, spot/              # CHANGED: definitions only (defaultConfig → autoMap); renderers and
│       │                                   #   old shaders removed (spot/test.html, volumetricSpot.* deleted)
│       ├── generic/                        # CHANGED: mapping, cells, strobe, surface light
│       ├── ledStrip/                       # CHANGED: stripPath.ts (NEW), pixel points, swept profile, segments;
│       │                                   #   test.html/test.js removed
│       └── effects/                        # NEW: particles.ts, laser/, flame/, co2/, spark/, fog/ (renderer +
│                                           #   visualization + settings each), EffectSettings.vue
├── assetLibrary/
│   ├── fixtureBody.ts                      # CHANGED: emitterIds, setCellColors
│   ├── catalog/fixtures.ts                 # CHANGED: effect types + nozzle beams (data-model §9)
│   ├── categoryMapping.ts                  # CHANGED: picks the new effect types
│   └── validate.ts                         # CHANGED: beam required for beam/effect types
├── scene/
│   ├── model/types.ts                      # CHANGED: environment, new config union
│   ├── model/defaults.ts                   # CHANGED: default environment
│   ├── model/sanitize.ts                   # CHANGED: load rules 1–6
│   ├── sceneSink.ts                        # CHANGED: active/onActivated, environmentChanged, v3 lifetime tracking
│   ├── sceneStore.ts                       # CHANGED: setEnvironment, setStripPath, environment → sinks
│   └── editor/
│       ├── stripPathTool.ts                # NEW: draw/edit strip paths (R17)
│       ├── editorOverlay.ts                # CHANGED: tool hosting, gizmo hidden while drawing
│       ├── Viewport.vue                    # CHANGED: activity (IntersectionObserver/visibility), HUD
│       ├── EditorToolbar.vue               # CHANGED: Environment, Display, Draw LED strip
│       ├── EnvironmentPopover.vue          # NEW
│       ├── DisplayPopover.vue              # NEW
│       └── inspector/FixtureVisualizationProperties.vue  # CHANGED: per-type sections, path controls
└── stage/fixtures/dmx/dmx.fixture.ts       # CHANGED: null channels keep their index (R3 bug fix)
```

**Structure Decision**: single Vite project.
- **Shared code**: decoding, mapping, lighting, quality and environment live in `src/visualization`, which the show window bundle imports. They have no store or editor imports.
- **Editor-only code**: the mapping editor UI (it needs the fixture's OFL definition through the controller), the popovers and the strip tool live in `src/scene/editor` or next to the visualization settings components, as today.
- **Asset contract**: the 002 contract is extended in place (`fixtureBody.ts`, catalog) rather than forked.

## Implementation Approach (high level, details go to tasks.md)

1. **Plumbing first (FR-053/054, protocol v3)**:
   - `Uint8Array` values, per-frame application, and the `SceneView` active state with `Viewport.vue`/`StageView.vue` activity.
   - Sink `active` plus heartbeat/bye, and server gating.
   - `update(frame)` on renderers.

   Everything else builds on the frame loop.
2. **Capabilities core**: `oflResolve` (plus the `channelNames` null fix), `autoMap`, `decode`, `colorMath`, `strobe`, `movement`, `beamState`; mapping types; sanitize load rules 2–4, 6. Check auto-mapping output for the 10 SC-001 fixtures in the browser console before any UI exists.
3. **SurfaceLighting** replacing `LedStripLighting` and the SpotLights: the light list, priority tiers and the gobo atlas. Then **BeamRenderer** with haze, prism instancing, gobo/split in the beam and center-ray beam length (US1, US3 core = MVP).
4. **Mapping editor UI** and per-type settings, Auto-Assign with confirm (US2). The environment popover and the `environment` scene field (haze, ambient) with sink and protocol (US3, US7).
5. **LED strips**: path model and load rule 5, pixel points, swept profile, segment lights; the **strip drawing tool**; cells and `setCellColors` for Generic (US4).
6. **Quality and preferences**: profiles, resolution-aware bloom, Display popover and show-window gear, HUD, device fallback; the **shadow atlas** and beam cut-off at High (US6, US3.4–5).
7. **Special effects**: the particle core, then laser, flame, CO2, spark, fog with haze coupling; catalog and category-mapping updates; strobe/blinder on Generic (US5).
8. **Performance pass** with `reference-scene.lmp` (SC-002/003), tuning of the profiles, and manual verification Q1–Q23 in both targets. Spec status → Implemented.

## Risks

| Risk | Mitigation |
|---|---|
| Fragment cost of the light loop misses SC-003 on integrated GPUs | Low profile: 6 + 16 lights, 64 segments, 0.75 render scale, no MSAA. Early-out per light on range and cone. Measure in step 3 with 70 lights. Fallback: a world-grid binning of segments and lights (R10 alternative). |
| The custom lighting looks different from today's SpotLight look | Tune falloff and softness against screenshots of the current build in step 3. Ambient defaults keep the editor readable. |
| OFL definitions vary widely (missing ranges, odd entity strings) | The auto-mapper is tolerant: unknown entities → default ranges, ambiguous → unmapped. The SC-001 checklist with 10 real fixtures is run in step 2, before the UI. |
| The `null`-channel fix changes channel indices in existing projects | Only affects modes that contain `null` (rare). Mentioned in the commit message. Old mappings are manual and can be re-assigned. |
| The shadow atlas re-renders the scene up to 8× per frame at High | Only lights that moved re-render. Tile size 512. The High preset is optional (Medium is the default and has no shadows). |
| BroadcastChannel heartbeat timing misjudges a window as gone | A 6 s timeout with 2 s beats. A late heartbeat simply re-registers the window and triggers a full-state send (idempotent). |
| Particles or lasers cost too much CPU with many effects | Pools sized by quality. Laser raycasts are capped per fixture and skipped while nothing moves. All effects of one view share one simulation pass. |

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Custom surface lighting (light data texture, gobo atlas, segment lights) instead of Three.js lights | FR-021 (gobo shapes on surfaces), FR-023 (prioritized tiers, no light disappears), FR-033 (no strip limit), SC-002 (70+ lights). It extends the material system every surface already uses (R7). | A pool of `THREE.SpotLight`s: gobo maps need shadow maps, texture units cap the pool at a few lights, and changing light counts recompiles every material. Deferred/clustered rendering: far more infrastructure. |
| Shadow atlas (own depth tiles) | FR-022 requires shadows and beam cut-off at High, and our lights are not Three.js lights (R11). | Built-in shadows work only with built-in lights. Center-ray clamping alone does not give shadows on surfaces. |
| Five new visualization types plus a particle core | FR-040/041 require a dedicated effect per type with its own channels (R14). | One "Effect" type switching by model: the mapping UI and safe defaults would depend on the model. A particle library: a new dependency for about 150 lines of code. |
| Show-window lifetime tracking (heartbeat/bye) | FR-053 / SC-006 require that no values are sent with no window open. Today windows are never forgotten (R15). | `pagehide` alone is unreliable when a window process is killed or crashes. |
