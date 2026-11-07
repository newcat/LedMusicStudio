# Research: Scene Model & 3D Scene Editor

**Feature**: 001-scene-editor | **Date**: 2026-11-07 | **Plan**: [plan.md](./plan.md)

This document resolves the open technical questions of the plan. Each entry gives the decision, the reason, and the alternatives that were rejected.

## Findings from the current code

These facts shape most of the decisions below.

- `src/visualization/visualizationServer.ts` (main window) owns one `FixtureVisualizationController` per fixture and sends JSON-encoded messages over a `BroadcastChannel("visualization")` to the separate window (`visualization.html` → `StageView.vue` → `StageRenderer`/`RenderingInstance` in `stageRenderer.ts`). The main window renders nothing in 3D today.
- The static scene is a raw `THREE.ObjectLoader` JSON (`baseScene`) that must contain a `PerspectiveCamera`. Every `MeshStandardMaterial` in it is replaced by the **single shared** `ModifiedStandardMaterial` (a `three-custom-shader-material` that adds LED strip lighting), so all surfaces lose their own color.
- Placement differs per type: moving head `position` + `rotation` (degrees) in config; spot `position` + `target`; LED strip `start`, `end`, `direction` in world space. The settings components edit these values, partly with an "Apply" button.
- LED strip lighting is a module-level singleton (`ledStripInstanceManager`, max. 8 strips) that feeds world-space uniforms to the shared material.
- `RenderingInstance` disposes the WebGL renderer but not the scene's geometries/materials, and `StageRenderer.loadScene` creates a new instance without disposing the previous one.
- Project files are a JSON string (`globalState.save()`); stage export/import uses `stage.save()`/`stage.load()`. Files are read and written through the native adapter (`chooseAndReadFile`, `chooseAndWriteFile`, Electron `writeFile`), which already works in both targets.
- `three@0.176` is installed; its `examples/jsm` add-ons (OrbitControls, TransformControls, CSS2DRenderer, GLTFLoader) ship with the package.

---

## R1. Source of truth and data flow

**Decision**: The scene is plain, serializable data (`SceneState`, see [data-model.md](./data-model.md)) held in a new Pinia store `useScene` in the main window. All edits go through **commands** on that store. A `SceneView` (Three.js) mirrors the state into `Object3D`s; it never owns state. The embedded editor and the show window both use the same `SceneView` class; the editor adds an `EditorOverlay` (controls, handles, grid, highlights, labels) on top.

Continuous transform drags mutate the `Object3D` directly for smoothness, write a throttled *preview* into the store (no history entry, so the inspector and the show window follow), and commit **one** history entry on pointer-up.

**Rationale**: One data model serves save/load, undo, the inspector, the outliner and the show window. Keeping Three.js objects out of reactive state avoids Vue proxy overhead on large object graphs (SC-004).

**Alternatives considered**:
- *Three.js scene graph as the source of truth, serialized with `ObjectLoader`*: this is today's model. It makes undo, kind-specific properties, fixture links and stable forward-compatible saves hard, and it ties the file format to Three.js internals.
- *Reactive `Object3D`s in Pinia*: deep proxies on Three objects are slow and break internal identity checks.

## R2. Embedded editor vs. show window rendering

**Decision**: The editor renders in the main window's JS realm with its own `WebGLRenderer`. The show window (`visualization.html`) stays a separate page with its own `SceneView`. Both receive the same inputs through one interface, `SceneSink`:

- the editor's sink calls the local `SceneView` directly;
- a `BroadcastSceneSink` forwards the same calls over the `BroadcastChannel` (see [contracts/show-window-protocol.md](./contracts/show-window-protocol.md)).

The `VisualizationServer` is reduced to fixture-value plumbing and fans out to all registered sinks.

**Rationale**: Reuses the existing window, entry point and channel. The editor needs synchronous access to Three objects for picking and handles, which a remote renderer could not offer.

**Alternatives considered**:
- *Render the editor in an `<iframe>` of the show window page*: adds a message hop to every pick and drag, and makes TransformControls/outliner integration awkward.
- *`OffscreenCanvas` in a worker*: `TransformControls`/`OrbitControls` need DOM events; there is no present need for this complexity.

## R3. Messages to the show window

**Decision**: Switch from `JSON.stringify` strings to structured-clone objects (`postMessage(obj)`), versioned with a `protocol` number. On `hello` (window opened), the main window sends a `snapshot` (full `SceneState` without asset bytes, plus fixture configs and current values), then each asset once as `asset` (with an `ArrayBuffer`). Afterwards it sends `objectsChanged` / `objectsRemoved` patches (batched per animation frame) and `fixtureValues` batches. Camera changes in the show window never go back to the main window.

**Rationale**: Structured clone carries binary model data without base64 and avoids double encoding; per-frame batching keeps the show window well inside the 0.5 s budget (FR-051) without flooding the channel during drags. Several show windows can listen at once; each sends `hello` and gets its own snapshot (edge case "opened twice").

**Alternatives considered**: *Sending the full scene on every change*: simple, but drags of large scenes would serialize hundreds of objects per frame. *Comlink over the channel* (present in `StageView.vue` but unused by the server): one-to-many broadcast does not fit an RPC model; it is removed.

## R4. Undo / redo

**Decision**: A history of **object-level patches**. Each entry stores, for every affected object id, the object state before and after (`null` = not present), plus a label. Undo applies the "before" states, redo the "after" states. Camera positions and editor settings are not part of the history (FR-040 covers scene objects). Imported model bytes live in a separate asset table and are never copied into history entries; unused assets are dropped on save. The history is cleared when a project is loaded or reset. Stack depth: 200 entries.

A drag in progress is cancelled by undo: the overlay restores the pre-drag states it captured on pointer-down and does not record an entry (edge case).

**Rationale**: One mechanism covers add, delete, transform, rename, property change, reparent, hide/lock, align/distribute, duplicate and import, without a command class per action. Object states are small (a few hundred bytes), so storing full before/after copies is cheap.

**Alternatives considered**: *Command classes with `do`/`undo` per action*: more code and easy to get inverse logic wrong. *Whole-scene snapshots*: simpler still, but with 200 objects and 200 entries it wastes memory and makes the show window diff harder. *JSON patch libraries (immer patches)*: new dependency without a need.

## R5. Fixture visualization as a scene object

**Decision**:
- New object kind `fixtureVisualization` with `fixtureId: string | null`, `visualizationType` and `config`. The config keeps type-specific settings only; **position, rotation and target are removed from the configs** and come from the object transform.
- Local conventions (documented in the data model): the spot emits along local **−Y** (points down by default); the moving head uses the built-in model's orientation (base on local −Y, standing up); the LED strip's `start`/`end` are points in object-local space and it emits along local **+Y**. The renderer converts these to world space every frame from `matrixWorld` (the LED shader still receives world-space uniforms).
- `VisualizationServer` keys controllers by **object id**. Only linked objects get a controller; unlinked objects render with the "off" value. A fixture can be linked to at most one object; assigning a fixture that is already linked is rejected with a message.
- Creating a visualization from the fixture settings (`FixtureSettings.vue`) and from the editor both call the same store command (`addFixtureVisualization`).
- Deleting a fixture removes its visualization object outside the undo history; history entries that would re-create an object linked to a missing fixture restore it as unlinked. This keeps references valid without clearing the history.
- Changing the visualization type replaces `visualizationType` and `config` (new default config) but keeps id, name, transform and parent (edge case).

**Rationale**: Meets FR-006 (one placement mechanism) and makes parenting to trusses work for free. Picking the "natural mounting" axis per type keeps default placement sensible.

**Alternatives considered**: keeping per-type placement fields and syncing them to the object transform: two sources of truth, exactly the problem the spec removes.

## R6. Navigation, views and focus

**Decision**: `OrbitControls` from `three/examples/jsm`. Mouse: **left drag** orbit, **right drag** or **Shift+left drag** pan, **wheel** zoom; a left click without movement (< 4 px) selects. Top/Front/Side/Perspective views move the same `PerspectiveCamera` to axis-aligned positions around the current target, with a short animation; no orthographic camera. "Focus selection" fits the bounding sphere of the selection into the view (also works for hidden/far-away/tiny objects, using a minimum radius of 0.25 m).

**Rationale**: Built into the installed Three.js, so no new dependency. Keeping one perspective camera means the existing fixture renderers, which read camera position for beam shading, keep working (FR-014).

**Alternatives considered**: *Orthographic cameras for top/front/side*: the beam shaders assume a perspective camera and would need changes; the spec does not require true orthographic projection. *camera-controls* library: nicer damping, but an extra dependency without present need.

## R7. Transform handles, snapping, multi-selection

**Decision**: `TransformControls` (Three r176 API: add `controls.getHelper()` to the scene). Modes translate/rotate/scale, world/local space toggle. Snapping uses `setTranslationSnap`, `setRotationSnap` and `setScaleSnap` from the scene's editor settings (defaults 0.25 m, 15°, 0.1); holding **Ctrl** while dragging inverts the snapping state (FR-023).

For multi-selection, the handles attach to a temporary **pivot** at the center of the selection's bounds (oriented to the active object in local mode). On drag, the pivot's delta matrix is applied to every selected *root* object (selected objects whose ancestors are not also selected), so children are not moved twice.

Scale is clamped to ≥ 0.01 per axis and negative scale is not possible (edge case). Scaling a shape with handles changes the object scale; the inspector shows dimensions and scale separately (dimensions × scale = world size).

LED strip endpoints get two small sphere handles in the editor; dragging one attaches a translate-only `TransformControls` to it and updates `config.start`/`config.end` (FR-027).

**Rationale**: Standard behavior known from Three.js editor, Blender and Unity; no dependency.

**Alternatives considered**: hand-written gizmos: much more code for no gain.

## R8. Picking, highlight and labels

**Decision**:
- Picking: `Raycaster` against visible, unlocked objects; every `Object3D` built by `SceneView` carries `userData.sceneObjectId`, and the hit is resolved upwards to the nearest scene object. Beam/volume meshes set `raycast` to a no-op so clicking "through" a beam selects what is behind it.
- Fixture types without a visible body (spot, LED strip) get an editor-only proxy (small cone for the spot, a thin line/box between start and end for the strip) on a dedicated editor layer. The show window does not create these proxies.
- Highlight: a `BoxHelper` per selected object (active object in a brighter color), drawn on the editor layer. Labels: `CSS2DRenderer` with one label per object, toggleable.

**Rationale**: Simple, cheap, readable on top of bloom; no extra post-processing pass.

**Alternatives considered**: `OutlinePass` gives nicer outlines but interacts with the bloom composer and costs a full-screen pass per frame.

## R9. Shape materials and LED strip lighting

**Decision**: Replace the single shared `ModifiedStandardMaterial` by a factory `createLedLitMaterial(params)` that creates a `CustomShaderMaterial` per color/texture while all instances **share one uniforms object** from the LED strip instance manager. Shapes get one material per object (`color`, fixed roughness/metalness). For imported GLB models, each `MeshStandardMaterial`/`MeshPhysicalMaterial` is converted to a LED-lit material that copies color, maps (map, normalMap, roughnessMap, metalnessMap, emissive, emissiveMap, aoMap), roughness, metalness, transparency and side. Other material types are kept unchanged (they will not receive LED strip light).

The LED strip manager becomes per-`SceneView` instead of a module singleton, so the editor and a future second view in the same realm do not mix their strips.

**Rationale**: Keeps today's LED-on-surface effect while respecting per-object colors and imported textures (FR-037, US 7).

**Alternatives considered**: keep the shared material (all objects one color, textures lost: contradicts the spec); use real Three.js lights per LED segment (far too expensive).

## R10. Imported models

**Decision**: GLB (binary glTF) only, loaded with the existing `GLTFLoader` via `native.chooseAndReadFile` (works in both targets, no native adapter change). The bytes are stored in the scene's asset table (`assets[assetId]`), base64-encoded in the project JSON, and referenced by the `importedModel` object. Validation: parse once before the command runs; any parse error shows "Could not import model: …" and leaves the scene unchanged (FR-037). After parsing, the model is auto-scaled so its largest bounding-box side is at most 10 m when it exceeds 50 m or is below 0.01 m; the inspector offers "Restore original scale". Files over 20 MB show a warning about project size before import continues.

Models with external `.bin`/texture references (non-embedded `.gltf`) are rejected with a message. A model whose data fails to parse at load time (corrupt project) is shown as a red wireframe placeholder box with the label "Model could not be loaded" (FR-061).

**Rationale**: GLB is self-contained (textures embedded), already used for the built-in moving head, and loads in the browser without file system access.

**Alternatives considered**: storing models next to the project file (breaks the browser build and moving projects between machines); switching the project file to a ZIP container (bigger format change, not needed before 1.0; can follow if project sizes become a problem).

## R11. Project format change and old projects

**Decision**: `StageState.visualization` is replaced by `StageState.scene: SceneState` (with `formatVersion: 1`). On load, if `stage.scene` is missing and `stage.visualization` exists, a converter creates the default scene and converts each `visualizationStates[fixtureId]` into a `fixtureVisualization` object:

- moving head: position/rotation copied;
- spot: position copied; rotation computed so that local −Y points from `position` to `target`;
- LED strip: object position = `start`; `start` = `[0,0,0]`, `end` = `end − start`; rotation chosen so that local +Y matches the old `direction` (if `direction` is parallel to the strip, the closest valid orientation is used);
- anything not convertible is dropped.

The old `baseScene` is discarded and a one-time toast says that the static scene must be rebuilt. The commit message states that old static scenes are not migrated (constitution IV).

**Rationale**: Spec edge case and FR-007; small, isolated converter.

## R12. Lifecycle and leaks (FR-062, SC-006)

**Decision**: `SceneView.dispose()` cancels its animation frame loop, disposes every geometry, material and texture it created (tracked per object), the composer, the controls and the CSS2D renderer, calls `renderer.dispose()` and `renderer.forceContextLoss()`, and unsubscribes from the store and sinks. The editor component creates its `SceneView` on mount and disposes it on unmount (tab switch, project load). On project load/reset the store emits a `reset` and every view rebuilds from the new state. The show window disposes its view on `pagehide`.

**Rationale**: Today's code leaks renderers on every scene load; repeated editor mounts would multiply WebGL contexts (browsers cap them at ~16).

## R13. Keyboard shortcuts

**Decision** (active only while the pointer is over the editor or the editor has focus, and never while an `input`, `textarea`, `select` or `contenteditable` element has focus):

| Key | Action |
|---|---|
| W / E / R | Move / rotate / scale mode |
| Q | Toggle world/local axes |
| Delete, Backspace | Delete selection |
| Ctrl+D | Duplicate |
| Ctrl+C / Ctrl+V | Copy / paste |
| Ctrl+Z | Undo |
| Ctrl+Y, Ctrl+Shift+Z | Redo |
| F | Focus selection |
| Shift+S | Toggle snapping |
| Ctrl (held while dragging) | Invert snapping temporarily |
| 1 / 3 / 7 / 5 | Front / side / top / perspective view |
| H | Hide/show selection |
| Escape | Cancel drag, else clear selection |
| Ctrl+A | Select all |

The full list is the contract in [contracts/editor-ui.md](./contracts/editor-ui.md). On macOS, Cmd replaces Ctrl.

**Rationale**: W/E/R and F match the Three.js editor and Unity; the number keys mirror Blender's numpad views without needing a numpad.

## R14. Clipboard

**Decision**: Copy/paste uses an in-memory clipboard in the scene store (object states of the selected subtrees, with fresh ids on paste and fixture links removed), not the system clipboard.

**Rationale**: Covers FR-034 within the app; system clipboard access differs between Electron and browsers and is not needed.

## R15. Performance budget (SC-004)

**Decision**: Target 60 fps while orbiting and dragging with 200 objects / 50 fixture visualizations. Measures: no Vue reactivity on Three objects (R1); inspector updates during a drag throttled to one per animation frame; outliner rendered from a flat computed list with virtual scrolling only if needed; geometries for identical shape dimensions are not shared (YAGNI) unless measurement shows a need.

**Known risk**: each spot and moving head creates a real `THREE.SpotLight`. 50 real spotlights exceed what forward rendering handles smoothly and may hit shader uniform limits. Limiting the number of real lights is part of feature 003 (quality levels). If SC-004 fails only because of light count, this feature caps real `SpotLight`s at 16 per view (further fixtures keep their beam but cast no surface light) and records this in the verification notes.

The reference machine for SC-004 is recorded when the manual verification is carried out (hardware, browser and Electron version).

## R16. Dependencies

**Decision**: No new runtime dependency. Everything uses `three` (core + `examples/jsm`), `vue`, `pinia`, `primevue` (Tree for the outliner, InputNumber, ColorPicker, Menu/Toolbar), `@vueuse/core` and `uuid`, all already installed.

## R17. Automated tests

**Decision**: None required (constitution III). Pure functions with tricky math (reparent keeping world transform, distribute/align, old-format conversion, history apply) are written as side-effect-free modules so tests could be added later; adding a test runner is not part of this feature.
