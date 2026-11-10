---

description: "Task list for feature 003: Rendering & Fixture Capability Upgrades"
---

# Tasks: Rendering & Fixture Capability Upgrades

**Input**: Design documents from `specs/003-rendering-capabilities/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: There are no automated test tasks. The spec doesn't ask for them, and constitution III makes manual verification the default. Every phase ends with a manual checkpoint that refers to the quickstart scenarios (Q1–Q23). The pure decoders in `src/visualization/capabilities/` may get unit tests later, but no test runner is added here.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own. Work is committed directly to `main` (project convention). Every commit must pass `pnpm lint` and `pnpm build`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story from spec.md (US1–US7)
- Paths are relative to the repository root (single Vite project, see plan.md → Project Structure)

## Conventions every task must follow

- Units: meters, degrees, +Y up, Hz, rotations per second (rps), Kelvin. Color values are linear RGB 0..1 (values > 1 allowed for bloom). DMX values: 0..255 (8-bit) or 0..65535 (16-bit, `coarse·256 + fine`).
- `src/visualization/**` and `src/assetLibrary/**` MUST NOT import Pinia stores, Vue components of the editor, or anything from `src/scene/editor/**` or `src/scene/sceneStore.ts`. Exceptions are `.vue` settings components that already live under `src/visualization/fixtureVisualizations/**` and receive the controller as a prop, as today. `src/visualization/capabilities/**` imports only `three` (for `Color`), type-only `@/stage/fixtures/dmx/open-fixture`, and `@/assetLibrary/types`. The show window bundle depends on this.
- Three.js objects never go into reactive state. Use `markRaw` or keep them outside Vue.
- No new runtime dependencies (research R19). Never edit the generated `src/stage/fixtures/dmx/open-fixture.ts`.
- Every scene mutation from the UI goes through a `useScene` command (`runCommand` / `updateObjects` / preview-commit), so undo and show-window sync keep working.
- Renderers do their per-frame work in `update(frame: FrameContext)`. They never use `requestAnimationFrame`, `setTimeout` or `Date.now()`; time comes from `frame.time` / `frame.dt`.
- No browser `alert`/`confirm`/`prompt`. Use PrimeVue `ConfirmPopup` or toasts (`emitSceneToast`).
- Old projects must keep loading (data-model.md §8). If a task drops a load rule, the commit message must say that loading breaks (constitution IV).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module skeletons and contract types that later phases fill in.

- [X] T001 Create the folder skeletons `src/visualization/capabilities/`, `src/visualization/lighting/shaders/`, `src/visualization/fixtureVisualizations/beam/` and `src/visualization/fixtureVisualizations/effects/` (with subfolders `laser/`, `flame/`, `co2/`, `spark/`, `fog/`). Create `src/visualization/capabilities/index.ts`, which re-exports each module of the folder as it is created.
- [X] T002 [P] Create `src/visualization/capabilities/types.ts` by copying every type from `specs/003-rendering-capabilities/contracts/capability-mapping.ts`: `CapabilityKey`, all segment types, `CapabilityChannel`, `WheelSlot`, `WheelDefinition`, `CellMapping`, `CapabilityMapping`, `ResolvedChannel` and the API function types. Use type-only imports for `open-fixture`, `VisualizationType` and `FixtureAssetDefinition`. Add `export function emptyMapping(): CapabilityMapping` returning `{ channels: {}, wheels: {}, cells: [], mappedMode: null, mappedChannelCount: 0 }`.
- [X] T003 [P] Add the five new members to `VisualizationType` in `src/visualization/fixtureVisualization.ts`, keeping the existing string values exactly: `LASER = "Laser"`, `FLAME = "Flame"`, `CO2_JET = "CO2 Jet"`, `COLD_SPARK = "Cold Spark"`, `FOG = "Fog / Haze"`. Until their phases exist, `RENDERER_TYPES` in `src/visualization/sceneView.ts` and `src/visualization/fixtureVisualizations/factory.ts` map them to the Generic renderer/visualization, so `Record<VisualizationType, …>` still type-checks.
- [X] T004 [P] Create `src/visualization/quality.ts`:
  - `QualityLevel`, `QualityProfile` and `QUALITY_PROFILES` exactly as in contracts/renderer-api.ts. Values from research R12:
    - low: `pixelRatioScale 0.75, pixelRatioCap 1, msaaSamples 0, bloomMips 3, fullLights 6, simpleLights 16, shadowLights 0, stripSegments 64, beamRadialSegments 24, hazeOctaves 1, particlesPerEffect 128, laserBeamsPerFixture 8`
    - medium: `1, 1.5, 2, 5, 16, 48, 0, 192, 48, 2, 384, 16`
    - high: `1, 2, 4, 5, 32, 96, 8, 384, 96, 4, 1024, 32`
    - all levels: `shadowTileSize 512`
  - `detectDeviceSupport(renderer: THREE.WebGLRenderer): DeviceSupport`, reading `EXT_color_buffer_float`, `MAX_TEXTURE_IMAGE_UNITS` and `MAX_TEXTURE_SIZE` from `renderer.getContext()`.
  - `FallbackNotice` (contracts/renderer-api.ts).
- [X] T005 [P] Create `src/visualization/viewPreferences.ts` implementing `ViewPreferencesStore` (contracts/renderer-api.ts, research R16):
  - Key `localStorage["lms.viewPreferences"]`, stored as `{ v: 1, ...ViewPreferences }`.
  - Defaults: `editor: { quality: "medium", showFps: false }`, `show: { quality: "medium", showFps: false }`, `photosensitivityLimit: true`, `showTrueStrobeRate: false`. Invalid or unknown values fall back to these.
  - Listens to the `storage` event for that key and notifies subscribers, so main and show window stay in sync.
  - Also exports `useViewPreferences()`, returning a Vue `shallowRef<ViewPreferences>` kept in sync through `subscribe`. This file may import `vue`, but no Pinia.
  - Helper `flashLimitHz(p): number | null`: returns `3` when `photosensitivityLimit && !showTrueStrobeRate`, else `null`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**:
- The per-frame render loop and value plumbing (FR-053, FR-054, protocol v3).
- `SurfaceLighting` replacing `LedStripLighting` and all `THREE.SpotLight`s, with LED strips still working.
- The scene `environment` field.
- The capability decoding core.
- The new config shapes with load rules for old projects.
- The manual capability mapping editor.

After this phase the app works as before (beams, strips, generic), but on the new plumbing.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Frame loop and value plumbing (research R15, contracts/show-window-protocol-v3.md)

- [ ] T006 Change `src/visualization/fixtureVisualizations/base.renderer.ts`:
  - `RendererInputs` becomes `{ camera, assets, lighting: SurfaceLighting, environment: EnvironmentState, raycastTargets: () => readonly THREE.Object3D[] }` (contracts/renderer-api.ts). Import the `SurfaceLighting` and `EnvironmentState` types from the files created in T011/T013; add type stubs first if they don't exist yet.
  - `onFixtureValueUpdate(v: Uint8Array)` for all renderers.
  - Replace `updateWorld()` by `update(frame: FrameContext): void` (empty default) and export `FrameContext` from here.
  - Remove `getSurfaceLight()`.
- [ ] T007 Change `src/visualization/sceneView.ts` for activity and per-frame values:
  - `SceneViewOptions` gets `kind: "editor" | "show"`.
  - Add `setActive(active)` / `get active`. While inactive, the `requestAnimationFrame` loop is not scheduled.
  - `setFixtureValue(id, value: Uint8Array)` and `setFixtureConfig` only store the value and add the id to a `dirty` set.
  - At the start of each frame (and once on re-activation), apply `onConfigUpdate` then `onFixtureValueUpdate` for every dirty id, then clear the set. A value is applied at most once per frame (FR-054).
  - Build a `FrameContext` each frame:
    - `time` from `performance.now()` since view start, in seconds.
    - `dt` clamped to 0.1 s.
    - `fps` as a 500 ms rolling average.
    - `haze` from `EnvironmentState`, `flashLimit` from `setFlashLimit`, `quality` from `setQuality(level)` (default `"medium"`).
  - Call `renderer.update(frame)` for every fixture entry after `scene.updateMatrixWorld()`.
  - Add `onFrameStats(cb)` (fps, frameMs) and `onNotice(cb)`.
  - Remove `MAX_REAL_SPOTLIGHTS`, `updateLightBudget()` and every `getSurfaceLight` use.
  - Pass `raycastTargets` to renderers: all `Mesh` objects under entries whose scene object is a shape, a library asset or an imported model. The list is cached and rebuilt on `applyObjects` / `removeObjects`.
- [ ] T008 Change the protocol in `src/visualization/protocol.ts` to v3 (contracts/show-window-protocol-v3.md):
  - `PROTOCOL_VERSION = 3`.
  - Add `HeartbeatMessage { windowId, visible: boolean }`, `ByeMessage { windowId }` and `EnvironmentChangedMessage { environment: SceneEnvironment }`.
  - `FixtureValuesMessage.values: Record<string, Uint8Array>`; `FixtureSnapshot.value: Uint8Array`.
  - Update the union types and the header comment to point to the v3 contract.
- [ ] T009 Change `src/scene/sceneSink.ts`:
  - `SceneSink` gets `readonly active: boolean`, `onActivated(cb): () => void`, `environmentChanged(env)` and `fixtureValues(values: Record<string, Uint8Array>)` (contracts/renderer-api.ts `SceneSinkDelta`).
  - `LocalSceneSink` mirrors `view.active` and fires `onActivated` when the view turns active. It forwards `environmentChanged` to `view.setEnvironment`.
  - `BroadcastSceneSink`:
    - Tracks windows from `hello` / `heartbeat(visible)` / `bye`. A window is gone after `bye` or "6 s without a heartbeat", checked by a 1 s interval.
    - `active` = "at least one alive window whose last `visible` was true". `onActivated` fires on the transition false → true.
    - `fixtureValues` is dropped while inactive.
    - Batches `environmentChanged` per frame like objects.
    - `dispose()` clears the interval.
- [ ] T010 Change `src/visualization/showWindowClient.ts` and `src/visualization/StageView.vue`:
  - The client posts `heartbeat { windowId, visible: document.visibilityState === "visible" }` every 2 s and immediately on `visibilitychange`, and posts `bye` on `pagehide` (before disposing).
  - It handles `environmentChanged` → `view.setEnvironment`, and `fixtureValues` with `Uint8Array` values.
  - `StageView.vue` creates the view with `kind: "show"` and calls `view.setActive(document.visibilityState === "visible")` on `visibilitychange`.
- [ ] T011 Change `src/visualization/visualizationServer.ts`:
  - Convert controller values once before fan-out into `Uint8Array`: DMX `number[]` → `Uint8Array.from(values)`; LED strip `Color[]` → flat `[r0, g0, b0, r1, …]` of length `3 × numLeds`. Add the helper `toWireValue(type, value)`.
  - Send values only to sinks with `active === true`.
  - Subscribe to `sink.onActivated` for every registered sink and call `sendStateTo(sink)` when it fires.
  - `getConfigsAndValues()` returns `Uint8Array` values.
  - `src/scene/sceneStore.ts` must expose `forEachActiveSink(fn)` and an `onSinkRegistered` hook for this (add both in `src/scene/sceneStore.ts` next to `registerSink`).
- [ ] T012 Change `src/scene/editor/Viewport.vue`: create the view with `kind: "editor"`. Compute active = `container.clientWidth > 0 && container.clientHeight > 0 && intersecting && document.visibilityState === "visible"`, where `intersecting` comes from an `IntersectionObserver` on the container, and update it on observer, resize and `visibilitychange` events. Call `view.setActive(active)`. This covers the Programming tab, which hides the editor with `v-show`.

### Surface lighting replacing SpotLights and LedStripLighting (research R7, R10)

- [ ] T013 Create `src/visualization/environment.ts` implementing `EnvironmentState` (contracts/renderer-api.ts):
  - Holds the current `SceneEnvironment` (`setSettings(env)`).
  - `haze` = `settings.haze` (hazer coupling is added in US5).
  - `reportHazeOutput` is stored but not used yet.
  - `ambientFor(kind)` returns `settings.ambient[kind]`.
  - Export `DEFAULT_ENVIRONMENT`: `{ haze: 0.3, hazerCoupling: false, ambient: { editor: { preset: "house", brightness: 1 }, show: { preset: "dark", brightness: 1 } } }`.
  - Export `ambientLight(setting): { sky: THREE.Color; ground: THREE.Color; intensity: number }` per data-model §4: dark → intensity 0; house → sky 2700 K, ground 0.5 × sky, 0.15 × brightness; daylight → sky 6500 K, grey ground, 1.2 × brightness. Use `kelvinToRgb` from T017.
- [ ] T014 Create `src/visualization/lighting/surfaceLighting.ts` implementing `SurfaceLighting` (contracts/renderer-api.ts):
  - `addLight` / `setLight` / `removeLight` with `SpotLightParams | OmniLightParams`.
  - `addStrip` / `removeStrip` with `StripSegmentsSource`.
  - An `RGBA32F` `DataTexture` with 4 texels per light: `[pos.xyz, range]`, `[dir.xyz, cos(outer half-angle)]`, `[color.rgb, softness]`, `[goboTile, goboRotation, prismFacets + prismSpread/100, prismRotation]`. Omni lights use direction (0, 0, 0) and cos −2.
  - A segment texture (`RGBA32F`, 3 texels per segment: `[start.xyz, 0]`, `[end.xyz, 0]`, `[color.rgb (0..1), packed normal]`).
  - Uniforms `uLightCount`, `uLightData`, `uSegmentCount`, `uSegmentData`, `uGoboAtlas` (a 1×1 white placeholder until T026), `uAmbientColor`, `uOverflowLight`, `uShadowAtlas` (1×1 placeholder) and `uShadowTiles` (count 0).
  - Defines `MAX_LIGHTS` and `MAX_SEGMENTS`, taken from `quality.fullLights + quality.simpleLights` and `quality.stripSegments`. Changing quality changes the defines and sets `needsUpdate` on registered materials.
  - Segments: split each strip into segments of about 0.5 m ("rounded to whole pixels", at least 1 per strip), each with the average pixel color and the average normal. If the total exceeds `MAX_SEGMENTS`, halve the segment count per strip, starting with the strips farthest from the camera, until it fits (data-model §3).
  - Prioritization in this task is simply "all lights up to MAX_LIGHTS, in insertion order". Tiers come in US3.
  - `update(camera, scene, renderer, quality)` uploads the textures.
  - `dispose()` frees all textures.
- [ ] T015 Create `src/visualization/lighting/shaders/surfaceLighting.vert` (outputs `vWorldPosition`, `vWorldNormal`, like `src/visualization/shaders/modifiedStandardMaterial.vert`) and `src/visualization/lighting/shaders/surfaceLighting.frag`:
  - Loop `for (int i = 0; i < MAX_LIGHTS; i++) { if (i >= uLightCount) break; … }` with `texelFetch` from `uLightData`.
  - Spot: smoothstep cone between cos(outer) and cos(inner), where inner is derived from the softness. Inverse-square falloff `1 / (1 + d²)` with a smooth cutoff at `range`. Lambert with `vWorldNormal`. Skip early when outside range or cone.
  - Omni: falloff and Lambert only.
  - Segments: loop to `min(uSegmentCount, MAX_SEGMENTS)`, using the closest point on the segment plus 3 taps along it at ±⅓ of its length. Use the existing strip `intensity()` falloff from `modifiedStandardMaterial.frag` (`2.0 / (1.0 + d + 5.0·d²)`, times the normal-facing term).
  - Add `uAmbientColor` × albedo-independent tint, plus `uOverflowLight`. Write the sum to `csm_Emissive`.
  - Leave a clearly marked `// GOBO` hook (the cookie sample returns 1.0) and a `// SHADOW` hook (returns 1.0) for US1/US3.
- [ ] T016 Switch the material system to `SurfaceLighting`:
  - In `src/visualization/ledLitMaterial.ts`: delete `LedStripLighting`, `LedStripSource` and the old uniforms types. `createLedLitMaterial(lighting: SurfaceLighting, params)` passes `lighting.uniforms`, the new shaders and `defines: lighting.defines`, and registers the material with the lighting so quality define changes reach it. `convertToLedLit` stays.
  - In `src/visualization/sceneView.ts`: `lighting = new SurfaceLighting()`; call `lighting.update(camera, scene, renderer, quality)` before `composer.render()`.
  - In `src/assetLibrary/assetCache.ts`: change the constructor and type references from `LedStripLighting` to `SurfaceLighting`.
  - Delete `src/visualization/shaders/modifiedStandardMaterial.frag`, `src/visualization/shaders/modifiedStandardMaterial.vert`, `src/visualization/shaders/volumetricSpot.frag` and `src/visualization/shaders/volumetricSpot.vert` once nothing imports them.

### Scene environment (data-model §4, contracts/scene-state-delta.ts)

- [ ] T017 [P] Create `src/visualization/capabilities/colorMath.ts`:
  - `kelvinToRgb(k: number, out?: THREE.Color): THREE.Color`, using the Tanner Helland approximation, clamped to 1000–40000 K, converted to linear and normalized so 6500 K = (1, 1, 1).
  - `hexToLinear(hex: string, out?)`.
  - Constant additive primaries per research R4: W = (1, 1, 1), A = (1, 0.75, 0), UV = (0.25, 0, 0.6), lime = (0.6, 1, 0), indigo = (0.3, 0, 1), warm white = kelvinToRgb(3000), cold white = kelvinToRgb(6500).
  - `luminance(c)`.
- [ ] T018 Add the environment to the scene model:
  - In `src/scene/model/types.ts`: add the types `AmbientPreset`, `AmbientSetting` and `SceneEnvironment` (copied from contracts/scene-state-delta.ts), and the field `environment: SceneEnvironment` on `SceneStateBase`.
  - In `src/scene/model/defaults.ts`: `createDefaultScene()` sets `environment: structuredClone(DEFAULT_ENVIRONMENT)` (import from `@/visualization/environment`).
  - In `src/scene/model/sanitize.ts`: add `sanitizeEnvironment(raw)` (load rule 1). A missing environment gets the defaults. `haze` is clamped "0…1", `brightness` "0…2", and an invalid `preset` falls back to the default of its view. `hazerCoupling` must be a boolean, else false.
  - `src/scene/sceneStore.ts` `save()` writes `environment`.
- [ ] T019 Add the command `setEnvironment(patch: DeepPartial<SceneEnvironment>, coalesceKey?: string)` to `src/scene/sceneStore.ts`. It is undoable through `runCommand`, uses the label "Set haze" for haze-only patches and "Change environment" otherwise, and coalesces with the key. After every change and in `load`/`reset`, call `sink.environmentChanged(rawScene().environment)` for all sinks. `LocalSceneSink.reset` and the broadcast `snapshot` already carry the environment inside the scene. `SceneView.setScene` must call `setEnvironment(state.environment ?? DEFAULT_ENVIRONMENT)`.

### Capability decoding core (research R1, R2, R3)

- [ ] T020 [P] Create `src/visualization/capabilities/keys.ts` per data-model §1:
  - `KEYS_BY_TYPE: Record<VisualizationType, CapabilityKey[]>`, exactly as in the "Keys by visualization type" table (LED strip → `[]`).
  - `KEY_GROUPS` for the editor (Position, Intensity, Color, Beam, Effect).
  - `KEY_INFO: Record<CapabilityKey, { label: string; unit: "deg" | "ratio" | "K" | "rps" | "facets" | "slot" | "gate" | "pattern" | "onoff"; defaultValue: number; defaultRange: [number, number] | null; segmentKind: CapabilitySegment["kind"] | null; hasFine: boolean }>`, filled from the "Defaults when unmapped" table: dimmer default 1, shutter open, trigger off "on when > 50 % (≥ 128)", zoom 10…45, colorTemperature 2700…8000, rotations −1…1. `hasFine` is true for pan, tilt, dimmer and zoom.
- [ ] T021 [P] Create `src/visualization/capabilities/decode.ts`:
  - `readDmx(entry, values)`: returns `null` if `entry.channel < 0` or out of range. With `fine >= 0`, returns `coarse·256 + fine`.
  - `findSegment(entry, raw)`: segment bounds are 8-bit and "scaled ×257" for 16-bit raws; returns `null` if none matches.
  - `decodeScalar(entry, values, fallback)`: linear/angle interpolation inside the segment. An empty segment list means one implicit `0…255 → KEY_INFO.defaultRange`. Returns `entry.defaultValue` when unmapped.
  - Holding the previous value when no segment matches is done by the callers (state decoders keep their last value).
- [ ] T022 Fix `src/stage/fixtures/dmx/dmx.fixture.ts` `channelNames`: a `null` mode channel pushes the placeholder `"(unused)"` instead of being skipped, so channel indices match the DMX layout (research R3). The commit message must mention that fixtures whose mode contains `null` channels get correct, shifted channel indices.
- [ ] T023 [P] Create `src/visualization/capabilities/oflResolve.ts`:
  - `resolveModeChannels(definition, mode): ResolvedChannel[]`, in DMX order:
    - `null` → key `"(unused)"`, no capabilities.
    - String keys are looked up in `availableChannels`, then in `templateChannels` (matching `$pixelKey` templates).
    - A key that is a `fineChannelAliases` entry of a channel gets `fineOf` = the index of the coarse channel. A 24-bit third byte is resolved as an alias but marked as ignored.
    - Matrix inserts expand in the same order as `DmxFixture.channelNames` (`eachPixel…` / `eachPixelGroup` / explicit arrays, `perPixel` vs `perChannel`) and set `pixelKey`.
    - `switchChannels`: use the default channel.
  - Each capability list comes from `capability` or `capabilities` with its `dmxRange` (default `[0, 255]`).
  - Entity parsers: `parseAngle("-270deg" | "50%", physicalMax)`, `parseSpeedHz("10Hz" | "600rpm" | "fast" | "slow" | "stop" | "50%")` (fast = 20 Hz, slow = 1 Hz), `parseRotationRps(...)` (fast = 2 rps, slow = 0.1 rps, `"%"` → 1 rps at 100 %, "reverse"/"CCW" negative), `parseKelvin("3200K" | "warm" | "CTO" | "default" | "cold" | "CTB")` (warm 3000, CTO 3200, default 6500, cold/CTB 8000), `parseBrightness("off" | "dark" | "bright" | "%")` (0, 0.2, 1).
  - `goboImageOf(slot)`: a type guard that accepts the export's object form `resource: { image: { mimeType, data } }` when the mimeType starts with `image/svg+xml` and `data.length <= 32 * 1024`. Otherwise it returns null (the schema's string form also returns null).

### Config shapes and load rules (data-model §2, §8)

- [ ] T024 Replace the config types:
  - `src/visualization/fixtureVisualizations/beam/types.ts`: create `MovementSettings` and `BeamVisualizationConfig` from contracts/scene-state-delta.ts. Export `defaultMovement(): MovementSettings` = `{ mode: "realistic", panSpeed: 600, tiltSpeed: 400 }`.
  - `src/visualization/fixtureVisualizations/generic/types.ts`: `GenericVisualizationConfig { mapping, surfaceLight, lightAngle }`.
  - `src/visualization/fixtureVisualizations/ledStrip/types.ts`: `StripPathPoint`, `StripPath`, `LedStripVisualizationConfig { intensity, path, pixelSize }`.
  - `src/visualization/fixtureVisualizations/effects/types.ts`: `EffectVisualizationConfig` and the five option types.
  - Delete `src/visualization/fixtureVisualizations/movingHead/movingHead.visualizationConfig.ts` and `src/visualization/fixtureVisualizations/spot/types.ts`.
  - Update the `FixtureVisualizationObject` union in `src/scene/model/types.ts` to `FixtureVisualizationConfigByType` (contracts/scene-state-delta.ts) and fix every import, including `src/scene/model/legacy.ts` and `src/scene/sceneStore.ts` `withModelRanges` (pan/tilt ranges now go into `config.mapping.channels.pan/tilt` linear segments).
- [ ] T025 Write the load rules in `src/scene/model/sanitize.ts` (and a new `src/visualization/capabilities/sanitizeMapping.ts` for rule 6), following data-model §8 rules 2–6:
  - **Old Moving Head** `channelMapping.pan/tilt/beamAngle {channel, defaultValue, min, max}` + `red/green/blue`: linear entries with segment `0…255 → min…max`. `beamAngle` → `zoom`, and its `defaultValue` → `defaultBeamAngle`. RGB become linear 0…1 entries. All entries `source: "manual"`, `mappedMode: null`, default movement, `softness` by model id (profile 0.1, spot / moving-head-spot 0.25, par 0.4, wash/fresnel 0.7), `prismSpread 6`.
  - **Old Spot** `colorChannels [r, g, b, w]`: the same, with white.
  - **Old Generic** `channelMapping.intensity/red/green/blue/white`: intensity → `dimmer`. `surfaceLight` defaults to true for `fixture.strobe`, `fixture.blinder`, `fixture.led-bar`, `fixture.pixel-bar` and `fixture.led-panel`, false otherwise. `lightAngle`: blinder 90, strobe 120, bars/panels 60, else 90.
  - **Old LED strip** `start`/`end`: `path = { points: [{position: start, normal: [0, 1, 0]}, {position: end, normal: [0, 1, 0]}], interpolation: "linear", closed: false }`, `pixelSize 0.6`.
  - **`sanitizeMapping(mapping, type)`**: drop keys not in `KEYS_BY_TYPE[type]`; sort segments, clip them to `0…255` and remove overlaps; remove `wheel` references to missing wheels; clamp `movement.panSpeed/tiltSpeed` to "30…1500", `defaultBeamAngle` "1…120", `softness` "0…1", `prismSpread` "1…30", `lightAngle` "10…170", `pixelSize` "0.2…1".
  - **Path**: "fewer than 2 distinct points → the default path". Normals are normalized, zero → (0, 1, 0).
  - Push a `problems` entry for each repaired object (not for plain format conversion).
- [ ] T026 Update every `defaultConfig` to the new shapes, using `emptyMapping()` (auto-mapping comes in US2):
  - Moving head: `src/visualization/fixtureVisualizations/movingHead/movingHead.visualization.ts`.
  - Spot: `src/visualization/fixtureVisualizations/spot/spot.visualization.ts`.
  - Generic: `src/visualization/fixtureVisualizations/generic/generic.visualization.ts`.
  - LED strip: `src/visualization/fixtureVisualizations/ledStrip/ledStrip.visualization.ts`, with the default path from data-model §2 "two points: (−0.5, 0, 0) and (0.5, 0, 0), normals (0, 1, 0), linear, open".

  The existing renderers must keep compiling on the new configs:
  - `ledStrip.renderer.ts` reads `path.points[0]` and the last point instead of start/end, and builds `Uint8Array` colors into `SurfaceLighting.addStrip` as a straight strip. Full path support comes in US4.
  - The generic renderer reads `mapping.channels.dimmer/red/green/blue/white` through `decodeScalar`.
  - Spot/moving head renderers stay as they are until US1 replaces them. They read pan/tilt/zoom/RGB through `decodeScalar` and register one `spot` light in `SurfaceLighting` per renderer instead of their `THREE.SpotLight`, which is deleted.

### Manual capability mapping editor (contracts/rendering-ui.md)

- [ ] T027 Create `src/visualization/fixtureVisualizations/CapabilityMappingEditor.vue`, with props `mapping: CapabilityMapping`, `type: VisualizationType` and `controller` (DmxFixture controller), and emit `update:mapping`:
  - Groups from `KEY_GROUPS`, filtered by `KEYS_BY_TYPE[type]`.
  - Per key:
    - A channel `Select` with "— not mapped —" plus all channels of `resolveModeChannels(definition, mode)` labelled `<index+1>: <key>`.
    - A fine `Select` only when `KEY_INFO[key].hasFine`.
    - For linear keys, start/end `InputNumber`s (or a "Default" field when unmapped).
    - A "Segments ▸" expander with an editable table (from, to, kind, kind-specific values; add/remove rows) for keys with `segmentKind`.
    - Wheel keys show slot swatches (split = two halves) and 24 px gobo thumbnails (SVG as data URL; `generic:<n>` as a pattern icon).
    - A source badge (`auto` grey, `manual` blue). Any edit of an entry sets `source: "manual"`.
  - A "Cells ▸" table (emitter, pixel key, R/G/B/W/A/UV/dimmer selects) when `cells.length > 0`.
  - "Unmapped channels" lists channels that no key or cell references. Add `unmappedChannels()` to `src/visualization/capabilities/decode.ts`.
  - If the fixture has no definition or mode, show inline "Select a fixture and mode in the fixture settings to map channels."
  - Emits a new mapping object (no in-place mutation of the prop).
- [ ] T028 Wire the editor into the settings components:
  - `src/visualization/fixtureVisualizations/movingHead/MovingHeadVisualizationSettings.vue` and `src/visualization/fixtureVisualizations/spot/SpotVisualizationSettings.vue` render `CapabilityMappingEditor` bound to `config.mapping` through `useLiveConfig`. The old Auto-Assign button and `ChannelMapping` grid are removed (Auto-Assign returns in US2).
  - Same for `src/visualization/fixtureVisualizations/generic/GenericVisualizationSettings.vue`, plus a "Light surfaces" checkbox and a light angle `InputNumber` (10…170).
  - Delete `src/visualization/fixtureVisualizations/ChannelMapping.vue` and `src/visualization/fixtureVisualizations/channelValue.ts` once nothing imports them.

**Checkpoint**:
- `pnpm lint` and `pnpm build` are green.
- Q21: an old project loads with mappings converted to manual entries, and strips between their old endpoints.
- Beams, strips and generic fixtures render and light surfaces through `SurfaceLighting`.
- Switching to Programming stops the editor's render loop (check in DevTools Performance).
- With no show window open, no `fixtureValues` are posted (log in `BroadcastSceneSink.post` temporarily).

---

## Phase 3: User Story 1 – Beam fixtures behave like the real fixture (Priority: P1) 🎯 MVP

**Goal**:
- Spot, par, wash, profile, moving head and scanner react to dimmer, shutter/strobe, every color mixing model, color temperature, color macros, color wheel, zoom, gobo wheel and rotation, prism, and 16-bit pan/tilt.
- Pan/tilt, zoom and wheels move at a realistic speed.
- Gobos and prism show on surfaces and in the beam.

**Independent Test**: map a moving head's channels with the mapping editor, then step through dimmer, strobe, each color mode, color wheel slots, zoom, gobo and prism values, and confirm the preview reacts to each (quickstart Q4–Q8, with manual mapping).

- [ ] T029 [P] [US1] Create `src/visualization/capabilities/strobe.ts`. `class ShutterGate { update(segment: ShutterSegment | null, raw: number, frame: FrameContext): number }` returns the gate 0..1 (research R5):
  - `open` → 1, `closed` → 0.
  - `strobe`: duty 30 % with "at least one frame on".
  - `pulse`: sawtooth; `rampUp`/`rampDown`/`rampUpDown`: sawtooth and triangle shapes; `random`: a seeded hash per period.
  - The rate is interpolated between `rateStart` and `rateEnd` by the position in the segment.
  - Effective rate = `min(rate, frame.flashLimit ?? Infinity)`.
  - If the effective rate is above `frame.fps / 2`, the gate alternates 1/0 every frame instead of being sampled.
  - The phase is accumulated from `frame.dt`, not from absolute time, so rate changes don't jump.
- [ ] T030 [P] [US1] Create `src/visualization/capabilities/movement.ts`. `class AxisFollower { constructor(maxSpeed, accel = 2000); setTarget(x); setMaxSpeed(v); snap(x); update(dt): number }` implements research R6:
  - `desiredV = sign(err)·min(vMax, √(2·a·|err|))`
  - `v ← clamp(v + clamp(desiredV − v, ±a·dt), ±vMax)`
  - `x ← x + v·dt`
  - Snaps to the target when `|err| < 0.01` and `|v|` is small.
  - Retargeting keeps `v`, so the move redirects smoothly.
  - Also export `WheelFollower`, which moves a wheel position in slot units at 4 slots/s (≈ 0.25 s per slot) and wraps for continuous rotation.
- [ ] T031 [US1] Create `src/visualization/capabilities/beamState.ts`. `class BeamDecoder { constructor(); decode(mapping, values: Uint8Array, frame, config: BeamVisualizationConfig): BeamState }` (contracts/renderer-api.ts `BeamState`). It implements the color pipeline of research R4 in this order:
  1. **Additive mix**: R, G, B plus white/amber/uv/lime/indigo/warmWhite/coldWhite with the constants from `colorMath.ts`. When no color key at all is mapped, the mix is white (FR-003).
  2. **CMY multiply**: `(1 − C, 1 − M, 1 − Y)`.
  3. **Color wheel**: the position comes from the `wheelSlot` segment, or rotation (`rotation` segments advance the position by `rps × slots × dt`) through `WheelFollower`. The two neighbouring slot colors are blended by fraction. A split slot sets `splitColor` (the surface uses a 50/50 average). Temperature-only slots multiply by `kelvinToRgb`. `closed` slots → intensity 0. Frost raises softness by 0.5, and iris scales the beam angle.
  4. **colorTemperature multiply**.
  5. **colorMacro**: a `color` segment replaces the mix (split → `splitColor`).
  6. **Intensity**: `dimmer (default 1) × ShutterGate (default open)`.

  - Zoom → `beamAngle`, or `config.defaultBeamAngle` when unmapped.
  - Gobo wheel → `gobo` / `goboNext` / `goboBlend` from the slot images.
  - `goboRotation` / `prismRotation`: rotation segments integrate the angle with `dt`; angle segments set it directly.
  - Prism: from the `prism` key, either a wheel slot with `facets` or a linear/none segment ("0 (out)"). A non-zero `prism` value without wheel facets uses 3.
  - Pan/tilt targets come from `decodeScalar` (16-bit when fine is mapped).
  - Raws that match no segment keep the previous value.
- [ ] T032 [P] [US1] Create `src/visualization/lighting/goboAtlas.ts` implementing `GoboAtlas` (contracts/renderer-api.ts, research R9):
  - A 2048² RGBA `CanvasTexture`, as an 8×8 grid of 256² tiles.
  - `acquire(image)`: hash → tile, with reference counting.
  - `"generic:<n>"` draws one of 12 procedural patterns with 2D canvas code: 0 dots ring, 1 star, 2 bars, 3 ring, 4 triangles, 5 cross, 6 spiral arms, 7 grid, 8 flower, 9 half moon, 10 scattered dots, 11 breakup noise. White = light passes.
  - SVG markup is rasterized through `new Image()` with an SVG data URL onto the tile, converted to luminance. While it loads, the tile shows the generic pattern for the slot index. On error, it keeps the generic pattern and logs a console warning.
  - `release(tile)` frees the tile at reference count 0.
  - Wire it into `SurfaceLighting` (`gobos` property, `uGoboAtlas`) in `src/visualization/lighting/surfaceLighting.ts`.
- [ ] T033 [US1] Implement the `// GOBO` hook in `src/visualization/lighting/shaders/surfaceLighting.frag`:
  - Build a light-space basis from the light direction (the up vector picked to avoid degeneracy).
  - Project the fragment to `uv = (tangent-plane offset / (distance · tan(outer half-angle))) · 0.5 + 0.5`, rotated by `goboRotation`, and sample the atlas tile `goboTile` (skip when < 0).
  - Prism: when `prismFacets ≥ 3`, sum the cone and cookie for each facet `k` with the direction rotated outward by `prismSpread` degrees around an axis at angle `prismRotation + k·2π/facets`, divided by `facets`, so the total energy is unchanged.
- [ ] T034 [US1] Extend the beam shaders and move them to `src/visualization/fixtureVisualizations/beam/beam.vertex.glsl` and `src/visualization/fixtureVisualizations/beam/beam.fragment.glsl` (from `movingHead/`):
  - An `InstancedBufferGeometry` with an instance attribute `aFacet` (facet index). The vertex shader tilts each instance outward by `uPrismSpread` around an axis at `uPrismRotation + aFacet·2π/uFacets` (no tilt when `uFacets < 3`).
  - New uniforms: `uHaze` (alpha `mix(0.03, 1.0, pow(haze, 0.7))`, and noise turbulence scales with haze), `uHazeOctaves` (loop bound for the `fogging()` octaves), `uGoboAtlas`, `uGoboTile`, `uGoboRotation` (the fragment derives the cross-section coordinate and samples the gobo at low mip), `uSplitColor` + `uHasSplit` (half-plane color selection), `uLength` (beam length clamp, the fragment fades out over the last 5 %), `uIntensity`.
  - Keep `#include <clipping_planes_*>`. Delete the old files in `movingHead/`.
- [ ] T035 [US1] Create `src/visualization/fixtureVisualizations/beam/beam.renderer.ts`. `BeamRenderer extends BaseRenderer<BeamVisualizationConfig, Uint8Array>` replaces `SpotRenderer` and `MovingHeadRenderer`:
  - **Body**: loads the body on `onModelUpdate` like today (`loadBody`, `setModelScale`). The beam mesh and the lens cap hang on `body.beamAnchor`, as the current moving head does.
  - **Light**: registers one spot light in `inputs.lighting` (`addLight`) and removes it in `dispose`.
  - **Per frame** (`update(frame)`):
    1. `BeamDecoder.decode` with the latest values.
    2. Pan/tilt through two `AxisFollower`s, with `movement.mode === "instant"` → `snap`. Speeds = `panSpeed`/`tiltSpeed`, scaled by `panTiltSpeed` if mapped ("0 = fast = configured speed, 255 = 10 %").
    3. Zoom through an `AxisFollower` at "≈ 0.3 s full range".
    4. `body.setPanTilt` (only when the model has moving parts).
    5. Lens emitter = color × intensity × 4, via `body.setEmitterColor("all", …)`.
    6. Beam uniforms: color, intensity, angle, haze = `frame.haze`, gobo tile, prism, split.
    7. `lighting.setLight` with world position and direction from `beamAnchor`, `color × intensity`, `angle`, `softness`, `range = beam length`, gobo tile/rotation and prism fields.
  - **Gobo tiles**: acquired from `inputs.lighting.gobos` when the slot image changes and released on change or dispose.
  - **Beam radial segments**: `frame.quality.beamRadialSegments`; the geometry is rebuilt when the quality changes.
  - Beam meshes are excluded from raycasts and bounds, as today (`raycast = () => undefined`, `userData.excludeFromBounds`).
- [ ] T036 [US1] Switch to the new renderer: register `BeamRenderer` for `VisualizationType.SPOT` and `VisualizationType.MOVING_HEAD` in `RENDERER_TYPES` in `src/visualization/sceneView.ts`. Delete `src/visualization/fixtureVisualizations/spot/spot.renderer.ts`, `src/visualization/fixtureVisualizations/spot/test.html` and `src/visualization/fixtureVisualizations/movingHead/movingHead.renderer.ts`. Check that `createEditorProxy` behavior is unchanged: there is no proxy, because the body is pickable.
- [ ] T037 [US1] Create `src/visualization/fixtureVisualizations/beam/BeamVisualizationSettings.vue`, used by both the spot and moving head settings components (`MovingHeadVisualizationSettings.vue` and `SpotVisualizationSettings.vue` become thin wrappers or are replaced in their visualization definitions). It contains:
  - **Movement**: "Realistic" / "Instant", plus pan and tilt speed `InputNumber`s (30…1500 °/s), shown only for Realistic and only if the model has moving parts.
  - **Default beam angle**: 1…120, shown when zoom is unmapped.
  - **Edge softness**: a `Slider` (0…1).
  - **Prism spread**: 1…30 °, shown when `prism` is mapped.
  - The `CapabilityMappingEditor`.

  All edits go through `useLiveConfig` → `onConfigChanged` (undoable).

**Checkpoint**: Q4, Q5, Q6, Q7 and Q8 pass with manually mapped channels, in browser and desktop. A strobe at 10 Hz with the limit forced off (temporarily set `photosensitivityLimit: false` in localStorage) flashes visibly (SC-007).

---

## Phase 4: User Story 2 – Channel mapping configures itself from the fixture definition (Priority: P1)

**Goal**: creating a visualization for an OFL fixture maps every supported capability, with ranges, wheels and cells, from the selected mode. Manual corrections persist until Auto-Assign.

**Independent Test**: create visualizations for five different OFL fixtures and confirm that all supported capabilities are mapped correctly without manual work (quickstart Q1–Q3, SC-001 checklist).

- [ ] T038 [US2] Create `src/visualization/capabilities/autoMap.ts`. `autoMapCapabilities(definition, mode, type, model): CapabilityMapping` implements research R3:
  1. `resolveModeChannels`.
  2. For each non-matrix channel, map its capabilities to keys with the table of research R3 (Pan/Tilt, Intensity → dimmer, ShutterStrobe → shutter, ColorIntensity by color, ColorTemperature, ColorPreset → colorMacro, WheelSlot/WheelRotation/WheelSlotRotation by wheel type, Zoom/BeamAngle → zoom, Prism/PrismRotation, Fog/FogOutput → fogOutput). Only keys in `KEYS_BY_TYPE[type]` are mapped, and "The first matching channel wins". The fine channel comes from `fineOf`.
  3. Build segments per capability `dmxRange`:
     - Pan/Tilt: `linear` from `angleStart`/`angleEnd` (or `angle`), falling back to the model `movingParts` limits, then to −270…270 / −135…135.
     - Intensity / ColorIntensity: `linear` 0…1 with `parseBrightness`.
     - ShutterStrobe: `shutter` with the `effect` mapped (`Open`/`Closed`/`Strobe`/`Pulse`/`RampUp`/`RampDown`/`RampUpDown`; `Lightning`/`Spikes`/`Burst` → `random`) and `rateStart`/`rateEnd` from `parseSpeedHz`.
     - Zoom: `linear` angles from the entities, then `physical.lens.degreesMinMax`, then 10…45.
     - Wheel slot: `wheelSlot` with `slotNumber` or `slotNumberStart`/`End`.
     - Rotation: `rotation` with `parseRotationRps`.
     - ColorPreset: `color`.
     - NoFunction / Maintenance / Generic: `none`.
  4. Copy the wheels with the table of data-model §1 "Wheels". A color slot without colors and temperature → `["#ffffff"]`. A gobo without a usable image → `"generic:<(slotIndex) mod 12>"`. A prism slot uses `facets ?? 3`. AnimationGobo → `"generic:11"`.
  5. Cells for GENERIC with a matrix: pixel order X, then Y, then Z. Bind to the model emitters sorted naturally by id, with pixel i of P → emitter `floor(i·E/P)`. Per-cell R/G/B/W/A/UV/dimmer channels come from template channels with that `pixelKey`.
  6. Ambiguous cases stay unmapped, for example a second `Intensity` channel on a non-matrix fixture, or `Generic` without a known keyword.
  7. Set `mappedMode = mode.name`, `mappedChannelCount = channels.length`, and `source: "auto"` on every entry.

  Effect keywords for `Effect`/`Generic` channels come from research R14 (`laserPattern`: "pattern", "figure", "gobo"; `laserSize`: "size", "zoom"; `laserRotation`: "rotat"; `laserX`/`laserY`: "x", "y", "move"; `trigger`: "flame", "fire", "co2", "jet", "spark"; `height`: "height") and are matched on the channel key and `effectName`, case-insensitively.
- [ ] T039 [US2] Use auto-mapping in every DMX `defaultConfig(fixture)`. When `fixture.config.definition` and `mode` exist, `mapping = autoMapCapabilities(definition, mode, type, model)`, otherwise `emptyMapping()`. This applies to `movingHead.visualization.ts`, `spot.visualization.ts` and `generic.visualization.ts` in `src/visualization/fixtureVisualizations/`.
  - The model comes from `assetCatalog.get(modelId)`. Extend the signature to `defaultConfig(fixture, modelId?)` in `src/visualization/fixtureVisualization.ts`, and pass the model id from `src/scene/sceneStore.ts` (`addFixtureVisualization`, `setVisualizationType`, `addFixtureModel`).
  - `defaultBeamAngle` comes from `physical.lens.degreesMinMax[0]`, else 15.
  - Remove the now-redundant pan/tilt part of `withModelRanges` in `src/scene/sceneStore.ts` (auto-mapping already uses the model limits as fallback). Keep it for configs without a fixture.
- [ ] T040 [US2] Add Auto-Assign to `src/visualization/fixtureVisualizations/CapabilityMappingEditor.vue`:
  - An "Auto-Assign" button in the header that regenerates the mapping with `autoMapCapabilities`. If the current mapping has `manual` entries, a PrimeVue `ConfirmPopup` asks "Replace N manual mappings?" first. The result is emitted as one config change, so it is one undo step.
  - If nothing could be mapped, the toast "No supported capabilities found in this fixture mode." (`emitSceneToast`, warn).
  - The outdated notice "⚠ Fixture mode changed – mapping may be outdated" is shown when `fixture.config.mode?.name !== mapping.mappedMode` or `channelNames.length !== mapping.mappedChannelCount` (and `mappedMode !== null`).
  - The mapping is never changed automatically after creation (FR-011, US2.3).
- [ ] T041 [P] [US2] Add a dev-only console helper in `src/visualization/capabilities/autoMap.ts`: `export function describeMapping(mapping): string[]`, one line per key (`pan ← ch 1 (+fine 2), −270…270°`). Expose it on `window.__lmsDescribeMapping` only when `import.meta.env.DEV`. Use it for the SC-001 checklist.

**Checkpoint**: Q1, Q2 and Q3 pass. The SC-001 checklist (quickstart) is filled in for 10 fixtures with 100 % of the supported FR-001 capabilities auto-mapped. Misses are fixed in `autoMap.ts` / `oflResolve.ts`.

---

## Phase 5: User Story 3 – Haze, beams and light on the stage (Priority: P1)

**Goal**: the scene haze level controls beam visibility; fixtures light surfaces with color, shape and gobo; lights are prioritized without disappearing; and at High quality there are shadows and beams cut off at objects.

**Independent Test**: four moving heads aimed at the floor, haze 0 → 100 %: beam visibility changes and the floor shows colored spots (quickstart Q9–Q11).

- [ ] T042 [P] [US3] Create `src/scene/editor/EnvironmentPopover.vue` and add a toolbar button "Environment" (icon `mdi mdi-weather-fog`) to `src/scene/editor/EditorToolbar.vue` that toggles a PrimeVue `Popover` with:
  - **Haze**: a `Slider` 0–100 % plus an `InputNumber` (stored 0…1). The live drag uses `setEnvironment({ haze }, "haze")` so a drag is one undo step "Set haze".
  - **"Hazers raise haze"**: a checkbox (`hazerCoupling`) with the hint "Active fog/haze fixtures increase the haze while they run."

  The ambient controls are added in US7.
- [ ] T043 [US3] Create `src/visualization/lighting/lightPriority.ts`, `assignTiers(lights, camera, quality, previous)`:
  - `score = luminance(color) · (0.5 + angle/120) · visibility`.
  - `visibility` is 1 if the light's lit point (beam center hit point stored with the light, or the omni position) is inside the camera frustum, else 0.25.
  - Sort. Ranks < `fullLights` → `full`, < `fullLights + simpleLights` → `simple`, the rest → `overflow`.
  - "A light changes tier only if its score beats the boundary by 15 %."
  - Integrate it in `SurfaceLighting.update`: full lights keep the gobo and prism, simple lights get `goboTile −1` and `prismFacets 0`, and overflow lights are summed (`color × 0.02`) into `uOverflowLight` and left out of the texture. Lights with intensity 0 are skipped entirely.
- [ ] T044 [US3] Add beam length from the center ray in `src/visualization/fixtureVisualizations/beam/beam.renderer.ts`:
  - Each frame, if the beam anchor's world matrix changed or the raycast targets changed (version counter from `SceneView`), raycast along the beam direction against `inputs.raycastTargets()` with a `THREE.Raycaster` (`far = 100`).
  - Beam `uLength` = hit distance (or 100). The light `range` = hit distance + 2 m. The hit point is stored for light priority.
  - At most one raycast per fixture per frame; it is skipped while nothing changed.
- [ ] T045 [US3] Create `src/visualization/lighting/shadowAtlas.ts`, used only when `quality.shadowLights > 0`:
  - A 2048² depth render target (`DepthTexture`, `UnsignedIntType`), as a 4×4 grid of 512² tiles.
  - For the first `shadowLights` lights of tier `full`, a `PerspectiveCamera` (fov = outer angle + 5°, near 0.05, far = range).
  - Render the scene with `overrideMaterial = MeshDepthMaterial` into the tile viewport, with every camera layer except a new `NO_SHADOW_LAYER`. Beams, emitters, particles, strip pixels and editor objects must be put on `NO_SHADOW_LAYER` only and disabled for the shadow camera. Add `NO_SHADOW_LAYER = 2` next to `EDITOR_LAYER` in `src/visualization/sceneView.ts`.
  - Re-render a tile only when its light moved, its angle changed or the scene objects changed.
  - Write each light's tile index and view-projection matrix into `uShadowTiles` (a `mat4` array uniform of length `MAX_SHADOW_LIGHTS = 8`), and the tile index into texel 3 of the light data.
  - Skip with a `FallbackNotice` `"shadows"` when `DeviceSupport.maxTextureUnits < 12` or the depth texture can't be created.
- [ ] T046 [US3] Implement the `// SHADOW` hook in `src/visualization/lighting/shaders/surfaceLighting.frag`: for lights with a tile ≥ 0, transform `vWorldPosition` with the tile matrix, apply 2×2 PCF on the atlas sub-rect, and add a bias of 0.002. In `src/visualization/fixtureVisualizations/beam/beam.fragment.glsl`, fade the beam fragment to 0 when it lies behind the first occluder in its light's tile: pass the tile index and matrix as uniforms from `BeamRenderer`, which reads them from `SurfaceLighting` (`getShadowTile(handle)`).

**Checkpoint**: Q9 and Q11 pass at Medium. Q10 passes at High; until US6, set High temporarily through `localStorage["lms.viewPreferences"]` and reload.

---

## Phase 6: User Story 4 – LED strips and pixel fixtures show individual pixels (Priority: P1)

**Goal**: every strip pixel shows individually along freeform paths drawn on surfaces, nearby surfaces are lit, and there is no strip limit. Multi-cell fixtures drive each model cell.

**Independent Test**: a 300-pixel strip drawn around a platform edge, running a chase: each pixel lights individually and in order (quickstart Q17–Q19).

- [ ] T047 [P] [US4] Create `src/visualization/fixtureVisualizations/ledStrip/stripPath.ts`:
  - `class StripPathSampler { constructor(path: StripPath); readonly length: number; sample(t: number, outPos, outNormal) }`:
    - `linear`: straight segments; `curve`: `THREE.CatmullRomCurve3` with `curveType "centripetal"`, `closed` per the path.
    - An arc-length table with "16 samples per segment".
    - Normals are interpolated from the point normals by arc length.
  - `pixelPositions(sampler, n, outPositions: Float32Array, outNormals: Float32Array)` places pixel i at arc length `(i + 0.5)/N · L`.
  - "A total length < 1 cm → pixels are placed at the first point."
  - "N = round(length × 30)" when unlinked.
- [ ] T048 [US4] Rewrite `src/visualization/fixtureVisualizations/ledStrip/ledStrip.renderer.ts`:
  - **Value**: the RGB byte triplets (`Uint8Array`). N = `value.length / 3`, or `round(length × 30)` if there is no value.
  - **Pixels**: one `THREE.Points` with a `BufferGeometry` (position Float32, color `Uint8BufferAttribute` normalized), and a `ShaderMaterial` that draws round soft points with size in world units = pitch × `config.pixelSize`, at least 1.5 px on screen. Additive, `toneMapped: false`, `depthWrite: false`. Points layer → `NO_SHADOW_LAYER`. The color attribute is updated from the value bytes with `intensity` applied, with no `Color[]` copies.
  - **Positions**: object-local, recomputed when the path or N changes.
  - **Body**: sweep the profile cross-section (`fixture.ledStrip.profileWidth/Height` from the strip model, default model `fixture.led-profile`) along the path. Use `ExtrudeGeometry` with `extrudePath` (the sampler curve) for `curve`, and one box per segment merged with `mergeGeometries` for `linear`. Use the model's slot materials (acquire the template once and copy its `slot:*` mesh materials). The diffuser faces the point normals.
  - **Lighting**: register with `SurfaceLighting.addStrip`, supplying world positions/normals (transformed each frame only when `matrixWorld` changed) and the color bytes.
  - **Editor proxy**: keep the direction arrow at the path midpoint along its normal.
  - Delete `src/visualization/fixtureVisualizations/ledStrip/test.html` and `src/visualization/fixtureVisualizations/ledStrip/test.js`.
- [ ] T049 [US4] Add `setStripPath(objectId, path: StripPath, label = "Edit LED strip path")` to `src/scene/sceneStore.ts`. It validates per data-model §3 (≥ 2 distinct points, finite coordinates, normalized normals), writes `config.path` through `updateObjects` (undoable), and supports the preview/commit path (`previewPatches` + `commitPreview`) for drags.
- [ ] T050 [US4] Create `src/scene/editor/stripPathTool.ts`, the drawing state machine (data-model §6, contracts/rendering-ui.md "LED strip drawing tool"):
  - `start(objectId, { isNew })`.
  - Click → raycast surfaces with `view.raycastSurfaces(ndc)` (add it to `src/visualization/sceneView.ts`: it raycasts `raycastTargets` and returns the point, world normal and object id; it falls back to the floor plane y = 0 with normal +Y), then append a point offset "5 mm along the surface normal", converted to the object's local frame.
  - Shift locks the segment to the closest world axis. Backspace removes the last point.
  - Enter/double-click finishes ("Needs ≥ 2 points, otherwise Esc behavior") and commits with `setStripPath(..., "Draw LED strip")`.
  - Esc cancels: a new strip is removed with `removeObjectsWithoutHistory` and its add is undone via history; an existing strip keeps its path.
  - The ghost segment is a `THREE.Line` on `EDITOR_LAYER`, following the cursor (curve preview when smooth).
  - Status hint text: "Click to add points · Shift: straight · Backspace: undo point · Enter/double-click: finish · Esc: cancel".
- [ ] T051 [US4] Add path editing mode to `src/scene/editor/stripPathTool.ts`:
  - Yellow sphere handles at the points and grey midpoint handles on `EDITOR_LAYER`.
  - Dragging a point slides it along surfaces with `previewPatches`, and commits one undo step on release.
  - Clicking a midpoint inserts a point. Delete/Backspace removes the selected point ("min 2").
  - Esc or clicking empty space leaves the mode.
- [ ] T052 [US4] Host the tool in `src/scene/editor/editorOverlay.ts`: `activeTool: StripPathTool | null`. While a tool is active, it receives pointer and keyboard events first, the transform gizmo is hidden, selection clicks are disabled, and its hint is shown through the existing `snapHint` channel. Add the toolbar button "Draw LED strip" (icon `mdi mdi-led-strip-variant`) to `src/scene/editor/EditorToolbar.vue`. It creates an unlinked LED strip visualization named "LED strip N" (via `addFixtureModel` or a new `addUnlinkedFixtureVisualization(VisualizationType.LED_STRIP)` in `src/scene/sceneStore.ts`) and starts the tool with `isNew: true`.
- [ ] T053 [US4] Rewrite `src/visualization/fixtureVisualizations/ledStrip/LedStripVisualizationSettings.vue` (props now include the object id):
  - "Draw path" / "Edit path" buttons, which call the editor overlay through a small injected API, `provide("stripPathTool", …)` in `src/scene/editor/SceneEditor.vue`.
  - Path info "N points · L m".
  - Interpolation `Select` ("Straight segments" / "Smooth curve"), a "Closed loop" checkbox, a pixel size `Slider` (0.2…1) and intensity.
  - The read-only pixel count from the linked fixture ("300 pixels, 62 per meter").
  - Path changes go through `setStripPath`.
- [ ] T054 [P] [US4] Extend `src/assetLibrary/fixtureBody.ts` (contracts/renderer-api.ts `FixtureBodyDelta`):
  - `emitterIds: readonly string[]` in description order.
  - `setCellColors(colors: Float32Array)`: for merged emitters, write each emitter's RGB into its vertex range of the merged color attribute (`needsUpdate` once per merged mesh) and hide individually created meshes; for individual meshes, set `material.color`.
- [ ] T055 [US4] Create `src/visualization/capabilities/cellState.ts`. `decodeCells(mapping, values, emitterIds, fixtureColor, intensity): CellState`:
  - Per `CellMapping`, the color mix comes from its channels with the same additive constants as the beam pipeline. A cell without color channels uses the fixture color. A cell dimmer (if mapped) multiplies the fixture `intensity` (dimmer × shutter gate).
  - Write into a `Float32Array` in emitter order: "With more pixels than emitters, the emitter shows the average of its pixels. With fewer, the remaining emitters copy the nearest pixel." If the model has no `cell-*` emitters, all emitters show the average.
  - `average` = mean × intensity.
- [ ] T056 [US4] Rewrite `src/visualization/fixtureVisualizations/generic/generic.renderer.ts`:
  - **Per frame**: decode the fixture color (additive keys, white when none is mapped), the dimmer (default 1) and `ShutterGate` (default open), then `decodeCells`.
  - **Emitters**: `body.setCellColors(colors × 4)` when cells exist, else `setEmitterColor("all", …)`.
  - **Surface light**: when `config.surfaceLight` is set, one `spot` light from the body's beam anchor (or the model root, +Y), with `angle = lightAngle`, `softness 0.8`, `range 15` and the average color. Removed when unchecked.
  - In `CapabilityMappingEditor` (`src/visualization/fixtureVisualizations/CapabilityMappingEditor.vue`), show the hint "<P> pixels are spread over <E> model cells." when P ≠ E.

**Checkpoint**: Q17, Q18 and Q19 pass in browser and desktop. Q21 (old strip) still passes.

---

## Phase 7: User Story 5 – Special effect fixtures (Priority: P2)

**Goal**: lasers, flame projectors, CO2 jets, cold spark machines, hazers/fog machines, strobes and blinders each have a dedicated effect that reacts to their mapped channels.

**Independent Test**: place one fixture of each type, trigger each one, and confirm the dedicated effect appears and reacts (quickstart Q20).

- [ ] T057 [US5] Update the catalog in `src/assetLibrary/catalog/fixtures.ts` (data-model §9):
  - `visualizationTypes`: `fixture.laser` → `[LASER, GENERIC]`, `fixture.flame-projector` → `[FLAME, GENERIC]`, `fixture.co2-jet` → `[CO2_JET, GENERIC]`, `fixture.cold-spark` → `[COLD_SPARK, GENERIC]`, `fixture.fog-machine` → `[FOG, GENERIC]`.
  - `nozzleEffect()` gets a `beam: { node: "", position: [0, nozzleY, 0], direction: [0, 1, 0] }`. The fog machine gets `beam` at `[0, FOG_NOZZLE_Y, FOG_NOZZLE_Z]` with direction `[0, 0, 1]`.
  - In `src/assetLibrary/validate.ts`, require `beam` for models whose types contain SPOT, MOVING_HEAD, LASER, FLAME, CO2_JET, COLD_SPARK or FOG.
  - Run the asset workbench: "0 errors".
- [ ] T058 [US5] Update `src/assetLibrary/categoryMapping.ts`: Laser → `VisualizationType.LASER`; Smoke/Hazer → `FOG`. For Effect/Flower/Fan/Stand/Other, `effectModel()` results of flame-projector / co2-jet / cold-spark use `FLAME` / `CO2_JET` / `COLD_SPARK` instead of GENERIC. Strobe, Blinder, Pixel Bar and Matrix stay GENERIC.
- [ ] T059 [P] [US5] Create `src/visualization/capabilities/effectState.ts`. `decodeEffect(kind, mapping, values, options, frame, prev): EffectState` (contracts/renderer-api.ts):
  - `trigger` is on when ≥ 128, and **off when unmapped** (research R14).
  - `height` = 0..1 × `options.maxHeight` (default 1 when unmapped).
  - `fogOutput` 0..1 (default 0).
  - Laser: `on` = dimmer > 0 (or `laserOn`); color from RGB, else `colorMacro`, else `options.color`; `pattern` from `pattern` segments, else `options.pattern`; `size`/`rotation`/`x`/`y` per the KEY_INFO defaults (0.5 / 0 / 0 / 0). The rotation angle integrates `laserRotation` rps with `frame.dt`. The shutter gate applies.
- [ ] T060 [P] [US5] Create `src/visualization/fixtureVisualizations/effects/particles.ts`. `class ParticleEmitter { constructor(capacity, material: THREE.ShaderMaterial); emit(n, init: (i, p) => void); update(dt, step: (p) => void); readonly points: THREE.Points }`:
  - Struct-of-arrays `Float32Array`s (position, velocity, age, life, size, color).
  - A dead-slot free list.
  - One `THREE.Points` with dynamic attributes, uploaded once per frame (`setDrawRange`).
  - Capacity = `frame.quality.particlesPerEffect`; the emitter is resized when the quality changes.
  - Points on `NO_SHADOW_LAYER`.
  - Shared point shaders `effects/particle.vertex.glsl` / `effects/particle.fragment.glsl` in `src/visualization/fixtureVisualizations/effects/` (soft round sprite, additive or normal blending as a define, size attenuation).
- [ ] T061 [US5] Create `src/visualization/fixtureVisualizations/effects/effectRenderer.ts`, an abstract base on `BaseRenderer<EffectVisualizationConfig, Uint8Array>`. It loads the body (`loadBody`, `setModelScale`), attaches an `effectOrigin` group to `body.beamAnchor` (local +Z = effect direction), stores the values, runs `decodeEffect` in `update(frame)`, and calls the abstract `step(state, frame)`. It also provides `src/visualization/fixtureVisualizations/effects/EffectSettings.vue`, which shows the `CapabilityMappingEditor` plus option fields per kind (heights "0.5…15 m", beams "1…64", spread "1…180°", pattern select, color picker, fog type, haze contribution 0…1). It shows "No trigger channel mapped – the effect stays off." when `trigger`/`fogOutput` is unmapped.
- [ ] T062 [P] [US5] Create the laser in `src/visualization/fixtureVisualizations/effects/laser/laser.renderer.ts` and `laser.visualization.ts`:
  - Beams: `LineSegments` with a custom additive shader. Alpha = `mix(0.02, 1, pow(haze, 0.7))`; the lines stay 1–2 px wide using the `LineBasicMaterial` approach (no fat lines).
  - Patterns from state: `beam` (1), `fan` (N beams in a plane over `spread`), `cone` (N beams on a cone), `sheet` (a dense fan, N × 4), `dots` (N random fixed directions). Beam count `min(options.beams, quality.laserBeamsPerFixture)`. Pattern size scales the spread, rotation turns the pattern around the axis, X/Y (and pan/tilt) offset the axis by ±30°.
  - Hit points: CPU raycast per beam against `raycastTargets` when the pattern or transform changed; additive sprites at the hits.
  - The `laser.visualization.ts` definition has `compatibleFixtures: [FixtureType.DMX]`, `defaultConfig` with `autoMapCapabilities(..., LASER, ...)` and options `{ kind: "laser", pattern: "fan", beams: 8, spread: 40, color: "#00ff00" }`.
- [ ] T063 [P] [US5] Create the flame in `src/visualization/fixtureVisualizations/effects/flame/flame.renderer.ts` and `flame.visualization.ts`:
  - Particles rise along the origin's +Z at ≈ 6 m/s, with lifetime set so the column reaches `height`. Additive orange → red → dark ramp by age, with noisy lateral jitter.
  - While on, an `omni` light (`kelvinToRgb(2000)`, flicker = 0.8 + 0.2·noise(time·12), range 8) at the column middle; the light is removed when off.
  - States: off → on → fading "flame 0.3 s" → off.
  - Options default `{ kind: "flame", maxHeight: 3 }`.
- [ ] T064 [P] [US5] Create the CO2 jet in `src/visualization/fixtureVisualizations/effects/co2/co2.renderer.ts` and `co2.visualization.ts`: white normal-blended particles, fast up (≈ 15 m/s, decelerating), expanding size and fading alpha. Emission stops when the trigger ends, and the plume dissipates "within ≈ 1.5 s". No light. Options default `{ kind: "co2", maxHeight: 6 }`.
- [ ] T065 [P] [US5] Create the cold spark in `src/visualization/fixtureVisualizations/effects/spark/spark.renderer.ts` and `spark.visualization.ts`: bright additive point particles with an initial upward velocity chosen to reach `height`, gravity 9.81, and short trails (two points per spark, the previous position faded). A small warm `omni` light (`kelvinToRgb(3000)`, range 4) while on. Fades out within 1 s. Options default `{ kind: "spark", maxHeight: 3 }`.
- [ ] T066 [P] [US5] Create the fog machine in `src/visualization/fixtureVisualizations/effects/fog/fog.renderer.ts` and `fog.visualization.ts`: large soft normal-blended sprites, emitted along +Z at a rate ∝ output, with slow drift, growth and long life (8 s), at low alpha (haze type: smaller, fainter). Each frame it calls `inputs.environment.reportHazeOutput(objectId, output × options.hazeContribution)`. Options default `{ kind: "fog", fogType: "haze", hazeContribution: 0.5 }`.
- [ ] T067 [US5] Add hazer coupling to `src/visualization/environment.ts` (data-model §4): per frame, `h(t+dt) = h + dt · (Σ outputs − h) / τ`, with τ = 8 s while the sum is above `h` and 30 s while below. `haze = clamp(settings.haze + h, 0, 1)` when `hazerCoupling`, else `settings.haze`. Outputs of removed renderers are cleared through `reportHazeOutput(id, 0)` in their `dispose`. Call `environment.update(dt)` once per frame from `src/visualization/sceneView.ts` before the renderers' `update`.
- [ ] T068 [US5] Register the new types:
  - In `src/visualization/fixtureVisualizations/factory.ts`, add `LaserVisualization`, `FlameVisualization`, `Co2Visualization`, `SparkVisualization` and `FogVisualization`, each with `settingsComponent: markRaw(EffectSettings)`.
  - In `src/visualization/sceneView.ts`, map them in `RENDERER_TYPES`.
  - In `src/scene/model/sanitize.ts`, accept their configs (`options.kind` must match the type, else the defaults).
  - Check that `FixtureVisualizationProperties.vue` (`src/scene/editor/inspector/FixtureVisualizationProperties.vue`) offers them in the type select for DMX fixtures.
- [ ] T069 [US5] Strobe and blinder on Generic: check that `fixture.strobe` and `fixture.blinder` with the extended Generic renderer (T056) flash through `ShutterGate` with the flash limit, light the scene through their wide surface light (strobe 120°, blinder 90°), and drive blinder cells individually. Raise the Generic emitter gain for these two models to 8, so flashes "light up the scene" visibly (`src/visualization/fixtureVisualizations/generic/generic.renderer.ts`).

**Checkpoint**: Q20 passes in browser and desktop. With coupling on, the haze rises over seconds while the hazer runs and decays after it stops.

---

## Phase 8: User Story 6 – Quality settings and stable performance (Priority: P2)

**Goal**: low/medium/high per view and user, resolution-aware effects, an FPS overlay, no work while hidden, and graceful fallback.

**Independent Test**: on the reference scene, switch quality levels and check that the frame rate and the visual quality change; close all views and check that the load drops (quickstart Q12–Q16, Q22).

- [ ] T070 [US6] Apply the quality profile in `src/visualization/sceneView.ts`, `setQuality(level)`:
  - `renderer.setPixelRatio(min(devicePixelRatio, pixelRatioCap) × pixelRatioScale)`.
  - Recreate the composer's render target with `samples: msaaSamples` (WebGL2 `WebGLRenderTarget({ samples })`).
  - Set the bloom mip count, `lighting` defines (MAX_LIGHTS / MAX_SEGMENTS) and the shadow atlas on/off.
  - Pass the profile in `FrameContext.quality`, so renderers rebuild beam geometry and particle pools.
  - Positions, colors and beams must not depend on the level (US6.1).
- [ ] T071 [US6] Make bloom follow the view in `src/visualization/bloom.ts` and `src/visualization/sceneView.ts`: replace the fixed `new Vector2(4096, 4096)` with the drawing-buffer size. `UnrealBloomPass.setSize` follows `resize()` (canvas size × pixel ratio, FR-051). Make `nMips` configurable (`setMips(n)`, recreating the mip targets and blur materials) and driven by `quality.bloomMips`.
- [ ] T072 [US6] Add device fallback (FR-055) in `src/visualization/quality.ts` and `src/visualization/sceneView.ts`:
  - At view start, run `detectDeviceSupport`.
  - Hook `renderer.debug.onShaderError` so that a compile failure of a lighting or beam program downgrades one feature, in the order shadows → gobos (full lights treated as simple) → light count halved → MSAA 0. Rebuild, then emit one `FallbackNotice` per feature per view with the text "<Feature> is not supported on this device; a simpler version is used.".
  - The dev flag `?forceFallback=shadows|gobos|lights` (only `import.meta.env.DEV`) simulates it (quickstart Q22).
  - The view never throws out of the render loop: a render error is caught, logged once, and triggers the next fallback step.
- [ ] T073 [P] [US6] Create `src/visualization/ViewHud.vue`, with props `view: SceneView` and `showFps: boolean`:
  - Top-left, monospace, semi-transparent background: `60 fps · 16.6 ms`, updated every 500 ms from `view.onFrameStats`.
  - Notices from `view.onNotice`, each shown once, auto-hiding after 8 s, with a close button.
  - No PrimeVue dependency (the show window bundle stays small).
- [ ] T074 [US6] Create `src/scene/editor/DisplayPopover.vue` with toolbar button "Display" (icon `mdi mdi-monitor`) in `src/scene/editor/EditorToolbar.vue`:
  - Editor quality and show window quality (Low / Medium / High `SelectButton`).
  - "Show frame rate" checkboxes for the editor and the show window.
  - "Limit flash rate" (default on), with the hint "Limits strobes and flashes to 3 per second (photosensitivity).".
  - "Show true strobe rate", only enabled while the limit is off.

  All values are read and written through `useViewPreferences()`.
- [ ] T075 [US6] Wire the preferences into both views:
  - `src/scene/editor/Viewport.vue` subscribes to `viewPreferences` → `view.setQuality(p.editor.quality)` and `view.setFlashLimit(flashLimitHz(p))`, and renders `<ViewHud :view :show-fps="p.editor.showFps">`.
  - `src/visualization/StageView.vue` does the same with `p.show`, and adds a gear button next to the camera menu (same 3 s auto-hide) that opens a small plain-HTML panel with show quality, FPS overlay and the two flash checkboxes (no PrimeVue).
  - Changes in either window reach the other through the `storage` event (Q13).
- [ ] T076 [US6] Verify and tighten the idle behavior (FR-053, SC-006):
  - With the editor hidden (Programming view) and no show window, `VisualizationServer` must send no values, and `SceneView` must schedule no frames. Add a dev-only counter `window.__lmsVizStats = { framesRendered, valuesPosted }` in `src/visualization/sceneView.ts` and `src/scene/sceneSink.ts` behind `import.meta.env.DEV`.
  - Re-activating the view (switching back, or showing the show window) applies the latest state within one frame.

**Checkpoint**:
- Q13, Q14, Q15, Q16 and Q22 pass.
- Q12 is measured once with a temporary scene (the reference scene comes in Polish), and the numbers are noted.

---

## Phase 9: User Story 7 – Ambient and house lighting (Priority: P3)

**Goal**: dark / house lights / daylight presets with brightness, separate for the editor and the show window.

**Independent Test**: switch between the presets and adjust the brightness; the stage geometry becomes visible or hidden accordingly (quickstart Q13).

- [ ] T077 [US7] Apply ambient in `src/visualization/sceneView.ts`:
  - Replace the fixed `HemisphereLight(0xffffff, 0x909090, 1.2)` with one hemisphere light driven by `ambientLight(environment.ambientFor(options.kind))` (T013).
  - Also set `lighting.setAmbient(sky × intensity × 0.1)` so LED-lit surfaces receive a matching ambient tint.
  - "dark" = intensity 0: only fixtures light the scene (US7.1).
  - Tone-mapping exposure stays unchanged (research R13).
  - Updates on `setEnvironment`.
- [ ] T078 [US7] Add the ambient controls to `src/scene/editor/EnvironmentPopover.vue`: "Ambient – editor" and "Ambient – show window", each a `Select` (Dark / House lights / Daylight) plus a brightness `Slider` 0–200 % (stored 0…2), written with `setEnvironment({ ambient: { editor | show: … } }, "ambient-<view>")`.

**Checkpoint**: Q13 (ambient part) passes. Editor in house lights and show window in dark at the same time.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: reference scene, performance tuning, cleanup, documentation and the full manual verification.

- [ ] T079 Build the reference scene `specs/003-rendering-capabilities/reference-scene.lmp` (data-model §10): 40 moving heads (mixed spot/wash models, Stairville MH-X50 definition), 20 RGBW pars, 10 pixel bars (12 cells), 4 lasers, 2 hazers, 20 LED strips × 300 pixels on platforms and truss, haze 50 %, with a looping timeline pattern that drives all of them. Save it with the app in the browser build.
- [ ] T080 Do the performance pass on a production build (`pnpm build`, `pnpm serve`) with the reference scene: measure the fps per quality level in the show window at 1920×1080 (Q12). Tune `QUALITY_PROFILES` in `src/visualization/quality.ts`, the early-outs in `src/visualization/lighting/shaders/surfaceLighting.frag` and the particle/laser caps until "≥ 50 fps" at Medium on the reference machine (SC-002) and "≥ 30 fps" at Low on an integrated-graphics laptop (SC-003). If SC-003 is still missed, implement the world-grid binning fallback from research R10 in `src/visualization/lighting/surfaceLighting.ts` and record the decision in research.md.
- [ ] T081 [P] Clean up dead code: make sure nothing still references `LedStripLighting`, `MAX_REAL_SPOTLIGHTS`, `getSurfaceLight`, `updateWorld`, `channelValue.ts`, `ChannelMapping.vue`, `volumetricSpot.*`, `modifiedStandardMaterial.*` or the old renderer files (search `src/`). Delete leftovers and update the comments that reference protocol v2 in `src/visualization/protocol.ts`, `src/scene/sceneSink.ts` and `src/visualization/showWindowClient.ts`.
- [ ] T082 [P] Update the documentation: mark `specs/001-scene-editor/contracts/show-window-protocol.md` as superseded by `specs/003-rendering-capabilities/contracts/show-window-protocol-v3.md` (one line at the top). If `README.md` describes visualization capabilities, add haze, quality settings and LED strip drawing in one short paragraph.
- [ ] T083 Run all quickstart scenarios Q1–Q22 in the browser build and the desktop build, and Q23 with real DMX hardware in the desktop build. Fill in the SC-001 checklist and the Q12 frame-rate readings, and record the results in the commit message or PR description that closes the feature. Fix any failure before closing.
- [ ] T084 Set `**Status**: Implemented` in `specs/003-rendering-capabilities/spec.md` after T083 passes, and run `pnpm lint` and `pnpm build` one last time.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks all user stories. Internal order:
  1. T006 → T007 → (T008, T009) → T010, T011, T012.
  2. T013, T014 → T015 → T016.
  3. T017 → T018 → T019.
  4. T020, T021, T022, T023 in parallel.
  5. T024 → T025 → T026.
  6. T027 → T028.
- **US1 (Phase 3)**: after Foundational. T029, T030 and T032 in parallel → T031 → T033, T034 → T035 → T036 → T037.
- **US2 (Phase 4)**: after Foundational. It can run in parallel with US1; it only touches `autoMap.ts`, the visualization `defaultConfig`s and the mapping editor. T038 → T039 → T040; T041 any time after T038.
- **US3 (Phase 5)**: after US1, because it extends `BeamRenderer` and the beam shaders. T042 runs in parallel with everything else.
- **US4 (Phase 6)**: after Foundational. It is independent of US1–US3 except for using `ShutterGate` (T029) in T056; do T029 first, or stub the gate. T047 and T054 in parallel → T048 → T049 → T050 → T051 → T052 → T053; T055 → T056.
- **US5 (Phase 7)**: after Foundational, plus T029 (strobe), T038 (auto-map) and T056 (Generic for strobe/blinder). T059 and T060 in parallel → T061 → T062–T066 in parallel → T067 → T068 → T069; T057 and T058 any time.
- **US6 (Phase 8)**: after Foundational. T070–T072 touch `sceneView.ts`, so do them in order. T073 is parallel.
- **US7 (Phase 9)**: after T013 and T042 (popover).
- **Polish (Phase 10)**: after all desired stories.

### User Story Dependencies

- **US1 (P1)**: Foundational only. The MVP.
- **US2 (P1)**: Foundational only. Testable with any visualization; the visible reaction uses US1's renderer for beam fixtures.
- **US3 (P1)**: needs US1 (`BeamRenderer`).
- **US4 (P1)**: Foundational (+ T029 for the cell strobe).
- **US5 (P2)**: Foundational + T029, T038, T056.
- **US6 (P2)**: Foundational. Q12 is meaningful once US1–US5 exist.
- **US7 (P3)**: Foundational + T042.

### Within Each User Story

- Pure decoders (capabilities) before renderers, renderers before settings UI, store commands before editor tools.
- Commit after each task or logical group, with `pnpm lint` and `pnpm build` green.

### Parallel Opportunities

- Setup: T002, T003, T004 and T005.
- Foundational: T017, T020, T021, T022 and T023 (all different new files).
- US1: T029, T030 and T032.
- US4: T047 and T054.
- US5: T059 and T060, then T062–T066 (one folder each).
- US6: T073 alongside T070–T072.
- Across stories, after Foundational: US2, US4 and US6 can proceed alongside US1.

---

## Parallel Example: User Story 1

```text
Task: "T029 [US1] ShutterGate in src/visualization/capabilities/strobe.ts"
Task: "T030 [US1] AxisFollower/WheelFollower in src/visualization/capabilities/movement.ts"
Task: "T032 [US1] GoboAtlas in src/visualization/lighting/goboAtlas.ts"
# then
Task: "T031 [US1] BeamDecoder in src/visualization/capabilities/beamState.ts"
```

## Parallel Example: User Story 5

```text
Task: "T062 [US5] Laser renderer in src/visualization/fixtureVisualizations/effects/laser/"
Task: "T063 [US5] Flame renderer in src/visualization/fixtureVisualizations/effects/flame/"
Task: "T064 [US5] CO2 renderer in src/visualization/fixtureVisualizations/effects/co2/"
Task: "T065 [US5] Spark renderer in src/visualization/fixtureVisualizations/effects/spark/"
Task: "T066 [US5] Fog renderer in src/visualization/fixtureVisualizations/effects/fog/"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup, then Phase 2 Foundational. The app keeps working on the new plumbing; check Q21 and the idle behavior.
2. Phase 3 (US1): beam fixtures with all capabilities, mapped by hand.
3. **Stop and validate**: Q4–Q8 in both targets. Commit to `main` (deploys the browser build).

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → beam capabilities (MVP).
3. US2 → auto-mapping (SC-001). Together with US1 this makes the preview usable for programming.
4. US3 → haze, prioritized surface lighting, shadows.
5. US4 → LED strips and pixel fixtures.
6. US5 → special effects.
7. US6 → quality UI, HUD, fallback (the idle behavior already exists from Foundational).
8. US7 → ambient presets.
9. Polish → reference scene, performance tuning (SC-002/003), full manual verification.

Each increment keeps old projects loading and both targets working, so `main` can be deployed after every story.

---

## Notes

- [P] tasks = different files, no dependency on unfinished tasks.
- The [Story] label maps each task to a user story for traceability.
- Commit messages: mention the `null`-channel index fix (T022). Mention any dropped load rule (constitution IV). No breaking change is planned.
- Avoid putting Three.js objects into Vue reactivity, and calling browser dialogs.
