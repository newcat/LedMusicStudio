---

description: "Task list for feature 001: Scene Model & 3D Scene Editor"
---

# Tasks: Scene Model & 3D Scene Editor

**Input**: Design documents from `specs/001-scene-editor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: No automated test tasks. The spec doesn't ask for them, and constitution III makes manual verification the default. Each phase ends with a manual checkpoint taken from [quickstart.md](./quickstart.md).

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own. Work is committed directly to `main` (project convention). Every commit must pass `pnpm lint` and `pnpm build`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story from spec.md (US1–US8)
- Paths are relative to the repository root (single Vite project, see plan.md → Project Structure)

## Conventions every task must follow

- Units: meters, degrees in stored data and the inspector, +Y up, floor at y = 0, Euler order XYZ, transforms relative to the parent (data-model.md → Coordinate convention).
- `src/visualization/**` MUST NOT import Pinia stores or anything from `src/scene/editor/**` or `src/scene/sceneStore.ts`. It may import only `src/scene/model/types.ts` (and other `src/scene/model/*` pure modules). The show window bundle depends on this.
- Three.js objects are never put into reactive state. Wrap them with `markRaw` or keep them outside Vue.
- No new runtime dependencies (research R16). Use `three/examples/jsm/...` add-ons.
- Every scene mutation from the UI goes through a `useScene` command, so undo and show-window sync keep working.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module skeleton and shared types that everything else imports.

- [X] T001 Create the folder skeleton `src/scene/`, `src/scene/model/`, `src/scene/editor/`, `src/scene/editor/inspector/`, plus `src/scene/index.ts`, which re-exports `./model/types` and `./sceneStore` (add the store export once T012 exists)
- [X] T002 Create `src/scene/model/types.ts` by copying the type definitions from `specs/001-scene-editor/contracts/scene-state.ts`. Change `SceneAssetPersisted` into two types: `SceneAssetPersisted` (`data: string`, base64) for the file, and `SceneAsset` (`data: Uint8Array`) for memory. `SceneState` in memory uses `assets: Record<string, SceneAsset>`, plus a `PersistedSceneState` type for the file. Export a `SceneObjectKind` union and type guards `isShape`, `isFixtureVisualization`, `isImportedModel`, `isGroup`, `isKnownKind`. Import `VisualizationType` from `src/visualization/fixtureVisualization.ts` rather than redefining it, but keep its string values `"Led Strip" | "Spot" | "Moving Head"`
- [X] T003 [P] Create `src/visualization/protocol.ts` with typed messages for protocol v2, as defined in `specs/001-scene-editor/contracts/show-window-protocol.md`: the channel name constant `"lms-visualization"` and `PROTOCOL_VERSION = 2`. Define a discriminated union `ShowWindowMessage` for `hello`, `snapshot`, `asset`, `objectsChanged`, `objectsRemoved`, `camerasChanged`, `fixtureConfigs`, `fixtureValues` and `reset`. Every message carries `{ protocol: 2, type }`. Payloads are structured-clone objects (no JSON strings)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Scene data model, store with commands and history, a renderer that draws a `SceneState`, the adapted fixture renderers, save/load, and a working show window. After this phase, a project holds a scene that round-trips through save/load and renders in the show window. The embedded editor UI starts in US1.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Pure model modules

- [X] T004 [P] Create `src/scene/model/defaults.ts`:
  - `createDefaultScene()`. Per data-model.md: one shape object "Floor" (plane, `width: 20, depth: 20`, color `#3a3a3a`, at the origin); one camera position "Default" (position `[8, 6, 12]`, target `[0, 1, 0]`, fov 50, `isShowDefault: true`); `editorCamera` equal to it; settings `showGrid: true, showAxes: true, showLabels: false, snapEnabled: false, translationSnap: 0.25, rotationSnap: 15, scaleSnap: 0.1, transformSpace: "world"`; `formatVersion: 1`; empty `assets`.
  - `createShapeObject(shape, partial?)` with defaults "box 1 × 1 × 1 m, cylinder r 0.5 m h 1 m, plane 2 × 2 m, sphere r 0.5 m; color `#9e9e9e`".
  - `createGroupObject()`, and `createFixtureVisualizationObject(fixtureId, visualizationType, config)`.
  - `nextObjectName(scene, baseLabel)`, which returns e.g. "Box 3".
  - All ids come from `uuid` v4. Every object starts with `parentId: null, children: [], position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], visible: true, locked: false`
- [X] T005 [P] Create `src/scene/model/transformMath.ts`. These are pure functions that use `three` math classes (`Matrix4`, `Quaternion`, `Euler`, `Vector3`) but no scene graph:
  - `toMatrix(obj)` / `fromMatrix(matrix) → {position, rotation, scale}`. Degrees, Euler XYZ; rotation normalized to (−180, 180]; scale clamped to "each component ≥ 0.01".
  - `getWorldMatrix(scene, id)`, which walks `parentId` up to the root.
  - `reparentKeepingWorld(scene, id, newParentId) → {position, rotation, scale}`, using `local = inverse(parentWorld_new) × world` (FR-033).
  - `wouldCreateCycle(scene, id, newParentId)`.
  - `getDescendantIds(scene, id)` and `getSelectionRoots(scene, ids)` (selected ids whose ancestors are not selected, research R7).
  - `isEffectivelyVisible(scene, id)`: own `visible` AND all ancestors visible. Lock is not inherited.
- [X] T006 [P] Create `src/scene/model/history.ts` (research R4):
  - `HistoryEntry { label: string; before: Record<string, SceneObject | null>; after: Record<string, SceneObject | null>; rootOrderBefore: string[]; rootOrderAfter: string[] }`.
  - Class `SceneHistory` with `push(entry)` (clears the redo stack; max 200 entries, oldest dropped), `undo() / redo()` returning the entry to apply, `canUndo / canRedo` (reactive-friendly getters), and `clear()`.
  - Helper `applyObjectStates(scene, states, rootOrder)`: `null` deletes the object, otherwise a deep copy is set. It then rebuilds every parent's `children` arrays from the states.
  - Before/after states are deep copies (`structuredClone`).
- [X] T007 [P] Create `src/scene/model/assets.ts`:
  - `uint8ToBase64` / `base64ToUint8`, chunked so 50 MB inputs don't overflow the call stack.
  - `serializeAssets` / `deserializeAssets`.
  - `collectReferencedAssetIds(objectsIterable)`, used by the GC on save (data-model: "Assets not referenced by any object (also none in the undo history) are removed on save").
- [X] T008 [P] Create `src/scene/model/sanitize.ts` with `sanitizeScene(raw: unknown): { scene: SceneState; problems: string[] }`, implementing data-model.md → Validation rule 7:
  - Missing or invalid fields fall back to defaults.
  - Non-finite numbers are replaced.
  - Scale is clamped to ≥ 0.01; shape dimensions are clamped to ≥ 0.01 m.
  - An object with a missing parent becomes a root object.
  - `children` and `rootOrder` are rebuilt from `parentId`, and cycles are broken.
  - If more than one camera has `isShowDefault`, only the first keeps it.
  - Objects of unknown `kind` are kept verbatim.
  - An `importedModel` whose asset is missing is kept, and a problem is recorded.
  - Never throws.
- [X] T009 [P] Create `src/scene/model/legacy.ts` with `convertLegacyVisualization(legacy: LegacyStageVisualization, fixtureIds: Set<string>): SceneState`, following research R11. Start from `createDefaultScene()` and discard `baseScene`. Each `visualizationStates[fixtureId]` whose fixture exists becomes a `fixtureVisualization` object named after the fixture id (the stage later renames it to the fixture name):
  - **Moving Head**: copy `config.position` and `config.rotation` (degrees) into the transform, and keep `channelMapping`.
  - **Spot**: the transform position is `position`. Compute the rotation so that local −Y points from `position` to `target`. Keep `colorChannels`.
  - **Led Strip**: the object position is `start`; `start = [0,0,0]`, `end = end − start`. Choose the rotation so that local +Y matches the old `direction`; if `direction` is parallel to the strip, use the closest orthogonal direction. Keep `intensity`.
  - States that can't be converted are dropped.
- [X] T010 Remove the placement fields from the visualization configs:
  - `src/visualization/fixtureVisualizations/movingHead/movingHead.visualizationConfig.ts`: drop `position` and `rotation`.
  - `src/visualization/fixtureVisualizations/spot/types.ts`: drop `position` and `target`.
  - `src/visualization/fixtureVisualizations/ledStrip/types.ts`: drop `direction`; `start`/`end` are now object-local.
  - Update `defaultConfig` in `movingHead.visualization.ts`, `spot.visualization.ts` and `ledStrip.visualization.ts` to match. The LED strip default becomes `start: [-0.5, 0, 0], end: [0.5, 0, 0]`.

### Rendering (shared by editor and show window)

- [X] T011 Replace `src/visualization/modifiedStandardMaterial.ts` with `src/visualization/ledLitMaterial.ts` (research R9):
  - Class `LedStripLighting`, one per view, which owns the strip renderer list and the `DataTexture`. Move the logic of `LedStripInstanceManager` out of `ledStrip.renderer.ts`, keeping `MAX_INSTANCES = 8`. Its `update()` computes **world-space** `start`, `end` and `direction` uniforms from each strip renderer's `matrixWorld`: `start`/`end` are local points, and direction is local +Y transformed by the world rotation.
  - `createLedLitMaterial(lighting, params: { color?, map?, normalMap?, roughnessMap?, metalnessMap?, emissive?, emissiveMap?, aoMap?, roughness?, metalness?, transparent?, opacity?, side? })`, which returns a `CustomShaderMaterial` based on `MeshPhysicalMaterial`. Every material **shares the same uniforms object** of its `LedStripLighting`.
  - `convertToLedLit(lighting, material)` for imported GLB materials: copies all fields listed above from `MeshStandardMaterial`/`MeshPhysicalMaterial`; other material types are returned unchanged.
  - Keep using the shaders `src/visualization/shaders/modifiedStandardMaterial.frag/.vert`.
- [X] T012 [P] Create `src/visualization/objectBuilders.ts`. The entry point is `buildObject3D(obj: SceneObject, ctx: { lighting, getAsset(assetId), disposables })`, which returns an `Object3D` with `userData.sceneObjectId = obj.id`. Add `updateObject3D(o3d, obj, ctx)` to apply transform and kind props in place, and `disposeObject3D(o3d)`. Kinds:
  - **Shape**: geometry origin per data-model.md. Box and cylinder sit on their origin (bottom face at local y = 0); the plane lies in local XZ facing +Y; the sphere is centered. Material comes from `createLedLitMaterial` with the shape's color. Rebuild the geometry when the dimensions change.
  - **Group**: an empty `Group`.
  - **Unknown kind**: a placeholder, i.e. a red wireframe box 0.5 m with the kind name in `userData.placeholderLabel`.
  - **importedModel**: a "loading" placeholder until US7 implements it.
  - **fixtureVisualization**: an empty `Group` that the `SceneView` fills with the fixture renderer (T014).
  - Track every geometry, material and texture created, so disposal is complete (research R12).
- [X] T013 Adapt the fixture renderers to local placement:
  - `src/visualization/fixtureVisualizations/base.renderer.ts`: add an optional `createEditorProxy(): THREE.Object3D | null` (default `null`) and `updateWorld?(): void`. Change `RendererInputs` to `{ camera: THREE.Camera; lighting: LedStripLighting }`.
  - `movingHead/movingHead.renderer.ts`: remove the position/rotation handling from `onConfigUpdate`, and implement `dispose()` so it frees the beam geometry and materials and the cap material.
  - `spot/spot.renderer.ts`: remove position/target. Place the volume mesh and the `SpotLight` at the local origin, aimed along local −Y (target object at `[0, -1, 0]`). The proxy is a small cone (radius 0.1 m, height 0.2 m).
  - `ledStrip/ledStrip.renderer.ts`: store `start`/`end` locally, and register/unregister with `inputs.lighting` instead of the module singleton (delete the singleton). The proxy is a thin box between `start` and `end`, plus a short arrow along local +Y.
  - Set `raycast = () => {}` on beam and volume meshes in the spot and moving head renderers (research R8).
- [X] T014 Create `src/visualization/sceneView.ts`, which replaces `RenderingInstance`/`StageRenderer` in `src/visualization/stageRenderer.ts` (delete that file):
  - Constructor `new SceneView(canvas, { showEditorProxies: boolean })`. It creates the `WebGLRenderer` (antialias, SRGB, ACES, exposure 4, as today), a `PerspectiveCamera`, the `EffectComposer` with `RenderPass` + the existing `UnrealBloomPass` from `./bloom` + `OutputPass`, a `LedStripLighting`, and an ambient/hemisphere light so shapes are visible without fixtures.
  - API: `setScene(state: SceneState)` (full rebuild); `applyObjects(objects: SceneObject[], rootOrder)` (create or update, then re-parent the `Object3D`s to match `parentId`); `removeObjects(ids)`; `setAsset(assetId, data)`; `setFixtureConfig(objectId, config)`; `setFixtureValue(objectId, value)`; `setCameraPose(pose)`; `getCamera()`; `getObject3D(id)`; `getRoot()`; `resize(w, h)`; `onBeforeRender(cb)`; `dispose()`.
  - Fixture visualization objects get their renderer through the type map from the old `getFixtureRendererType` (typed map, no unexplained `as any`). When the visualization type changes, the renderer is replaced. Unlinked objects render with an "off" value (empty array).
  - Objects that are not effectively visible get `visible = false`.
  - The render loop calls `lighting.update()` and then `composer.render()`.
  - `dispose()` follows research R12: cancel the `requestAnimationFrame`, dispose all tracked resources, the renderers, `composer.dispose()`, `renderer.dispose()` and `renderer.forceContextLoss()`.
- [X] T015 Create `src/scene/sceneSink.ts`:
  - Interface `SceneSink { reset(scene: SceneState); objectsChanged(objects, rootOrder); objectsRemoved(ids); asset(id, mimeType, data); camerasChanged(cameras); fixtureConfigs(configs); fixtureValues(values) }`.
  - `LocalSceneSink`, which forwards to a `SceneView`.
  - `BroadcastSceneSink`, which implements contracts/show-window-protocol.md on the main-window side. It opens `new BroadcastChannel("lms-visualization")` and listens for `hello`; on each one it sends `snapshot` (scene without asset bytes, plus every fixture's config and current value, from a provider callback) to that `windowId`, followed by one `asset` message per referenced asset. It batches `objectsChanged`, `objectsRemoved` and `fixtureValues` per `requestAnimationFrame` (the latest state per object id wins). On `reset` it sends `reset` and then a `snapshot` to each known `windowId`. `dispose()` closes the channel.

### Store and integration

- [X] T016 Create `src/scene/sceneStore.ts`, the Pinia store `useScene`:
  - State: `scene` (`SceneState`, reactive; assets kept in a non-reactive `Map` via `markRaw`), `selection: string[]` (last = active), `history` (`SceneHistory`, `markRaw`), `clipboard`, `transformMode: "translate" | "rotate" | "scale"`, `sinks` (`Set<SceneSink>`, `markRaw`).
  - Core commands, each pushing one `HistoryEntry` and notifying all sinks: `addObjects(objects, parentId?)`, `updateObjects(id → partial, label)`, `removeObjects(ids)` (includes descendants; for a `fixtureVisualization` object it removes only the object, never the fixture, per FR-035), `reparent(ids, newParentId, index?)` (uses `reparentKeepingWorld`, rejects cycles), `setVisible`, `setLocked`, `rename`.
  - Preview API for drags: `previewTransforms(id → {position, rotation, scale})` updates state and sinks without history; `commitPreview(beforeStates, label)` pushes one entry; `cancelPreview(beforeStates)` restores without an entry.
  - `undo()` / `redo()` apply the entry via `applyObjectStates`. Before applying, any `fixtureVisualization` state whose `fixtureId` is not in `useStage().fixtures` gets `fixtureId = null` (data-model invariant 5).
  - Selection: `select(ids, mode: "replace" | "toggle" | "add")`, `clearSelection()`. Selection is pruned automatically when objects disappear.
  - `registerSink(sink) → unregister` sends `sink.reset(scene)` immediately.
  - `load(state)` / `reset()` replace the scene, clear the history and selection, and call `sink.reset`.
  - `save(): PersistedSceneState`: assets base64-encoded; unreferenced assets (objects + history) garbage-collected.
- [X] T017 Rework `src/visualization/visualizationServer.ts`:
  - Controllers are keyed by **scene object id**.
  - New method `syncWithScene(objects)` creates, replaces or removes `FixtureVisualizationController`s for linked `fixtureVisualization` objects: a new controller when `fixtureId` or `visualizationType` changes, and `controller.config` set when the object's `config` changes.
  - Controller `configChanged` and `valueChanged` events go to all registered sinks as `fixtureConfigs` / `fixtureValues`, keeping the `paused` handling.
  - `getConfigsAndValues()` for snapshots.
  - Remove `baseScene`, `loadScene`, the old BroadcastChannel and the old `save`/`load` of `visualizationStates`.
  - When a fixture with an object is deleted from `fixtures`, it calls back into the store to remove that object **outside the history** (data-model invariant 5, spec edge case). Implement this in the store as `removeObjectsWithoutHistory(ids)`.
- [X] T018 Integrate into `src/stage/stage.ts`:
  - `StageState` becomes `{ fixtures, controllers, scene: PersistedSceneState }`.
  - `save()` includes `useScene().save()`.
  - `load()`: if `state.scene` exists, run `useScene().load(sanitizeScene(state.scene))` and collect problems. If not, but `state.visualization` exists, run `convertLegacyVisualization(...)`, rename the converted objects to their fixture names, and show the one-time info toast with the exact text from contracts/editor-ui.md → Messages ("This project was created with an older version. …"). Otherwise load `createDefaultScene()`.
  - Show one warning toast summarizing load problems, if there are any.
  - `reset()` resets the scene to `createDefaultScene()`.
  - Wire a `watch` on `scene.objects` → `visualization.syncWithScene`.
  - Register a `BroadcastSceneSink` once at store creation.
  - Toasts come from a small event or callback, because the store has no `useToast`. The toast is raised in `src/App.vue` or `src/views/Stage.vue`.
- [X] T019 Update `src/globalState.ts` so `reset()` and `load()` go through `stage.reset()`/`stage.load()` (which reset the scene and history). Also make sure `src/views/Stage.vue` `importStage` calls `stage.reset()` before `stage.load(...)`, so an imported stage replaces the scene instead of mixing with it.
- [X] T020 Rewrite the show window on top of protocol v2:
  - Create `src/visualization/showWindowClient.ts`. It generates a `windowId`, opens the `"lms-visualization"` channel, sends `hello` after the `SceneView` is ready, and applies incoming messages addressed to it (or `"*"`) to the `SceneView`. Messages with a different `protocol` set a reactive `protocolMismatch` flag.
  - Update `src/visualization/StageView.vue`: remove the "No scene loaded" text and Comlink. Create `new SceneView(canvas, { showEditorProxies: false })` after `modelLibrary.initialize()`. Add `OrbitControls` (from `three/examples/jsm/controls/OrbitControls.js`) on the show window camera, starting at the show-default camera (data-model → Camera Position rules). Show "Please reload the visualization window" if `protocolMismatch` is set. Dispose on `onBeforeUnmount` and `pagehide`.
- [X] T021 Make sure `modelLibrary.initialize()` (`src/visualization/modelLibrary.ts`) is awaited before any `SceneView` creates moving head renderers, in both windows. Make it idempotent (return the same promise on repeated calls).

**Checkpoint**: `pnpm lint` and `pnpm build` pass. A new project saves and loads with `stage.scene`. "Open Visualizer" shows the floor and the existing fixture visualizations, which react to playback, with an orbitable camera. A pre-feature project loads with the one-time notice. The Visualization tab may still show the old placeholder.

---

## Phase 3: User Story 1 – Navigate and view the stage in an embedded 3D editor (Priority: P1) 🎯 MVP

**Goal**: The Visualization tab shows an interactive 3D view of the scene in the main window, with orbit/pan/zoom, Top/Front/Side/Perspective views, focus selection, grid and axes indicator.

**Independent Test**: Create a new project, open Stage → Visualization, and navigate the default scene with mouse and keyboard. Existing fixture visualizations are visible and react to playback (quickstart scenario 1).

- [X] T022 [US1] Create `src/scene/editor/editorOverlay.ts`, class `EditorOverlay` (navigation part): the constructor takes `(sceneView: SceneView, domElement: HTMLElement, store)`.
  - `OrbitControls`: left drag orbit, right drag / middle drag / Shift+left drag pan, wheel zoom towards the pointer (`zoomToCursor = true`).
  - `GridHelper` (20 m, 1 m cells, with 0.25 m subdivisions as a second fainter grid) on the editor layer, at y = 0.001.
  - An axis orientation indicator: a small `AxesHelper` rendered in a corner viewport after the main render via `renderer.setViewport`/`setScissor`, with the X/Y/Z labelled by color.
  - Both are toggled by `settings.showGrid` / `settings.showAxes`.
  - Editor-only helpers use a dedicated layer (e.g. layer 1) and are never sent to the show window.
  - `dispose()` removes everything.
- [X] T023 [US1] Add to `EditorOverlay`:
  - `setView("top" | "front" | "side" | "perspective")`. It moves the camera to an axis-aligned position around the current orbit target at the current distance, animated over 250 ms: front = camera at +Z looking along −Z, side = camera at +X looking along −X, top = camera above looking down −Y (with a tiny Z offset to avoid gimbal flip), perspective = the 45°/30° elevation default.
  - `focusSelection()`. It fits the bounding sphere of the selected `Object3D`s (minimum radius 0.25 m, so hidden, far-away or tiny objects still work) into the view and sets the orbit target to its center (research R6).
  - Persist the editor camera: on camera change, debounce 500 ms, then write `scene.editorCamera` via a non-history store setter `setEditorCamera(pose)`. Restore it on mount.
- [X] T024 [P] [US1] Create `src/scene/editor/useEditorShortcuts.ts`, a composable `useEditorShortcuts(isActive: Ref<boolean>, handlers: Partial<Record<ShortcutAction, () => void>>)`. It registers one `keydown` listener on `window` and ignores events when `document.activeElement` is an `input`, `textarea`, `select` or `[contenteditable]` (FR-041), or when `isActive` is false. It maps keys per contracts/editor-ui.md → Keyboard (Cmd = Ctrl on macOS), defines all actions now (handlers are added by later stories), calls `preventDefault` only for handled keys, and unregisters on unmount. US1 wires `1`/`3`/`7`/`5` (views) and `F` (focus).
- [X] T025 [US1] Create `src/scene/editor/Viewport.vue`. It hosts a `<canvas>` in a full-size container. On mount: `await modelLibrary.initialize()`, create `new SceneView(canvas, { showEditorProxies: true })`, call `store.registerSink(new LocalSceneSink(view))`, and create an `EditorOverlay`. Resize uses `useResizeObserver` + `useThrottleFn` (as in the current `StageView.vue`). It tracks `isActive` (pointer over the viewport, or focus inside the editor) for shortcuts. On unmount it unregisters the sink and disposes the overlay and view (FR-062). It exposes the overlay to the parent via `defineExpose`.
- [X] T026 [US1] Create `src/scene/editor/EditorToolbar.vue` with the US1 controls: a View menu (Perspective/Top/Front/Side, labelled with their keys), a Focus button, and Grid and Axes toggle buttons bound to `scene.settings.showGrid/showAxes` via a non-history store setter `updateSettings(partial)`. Use PrimeVue `Button`/`Menu` and `mdi` icons, like the rest of the app.
- [X] T027 [US1] Create `src/scene/editor/SceneEditor.vue`, with the layout from contracts/editor-ui.md → Layout: the toolbar on top and a `splitpanes` row of outliner slot | viewport | inspector slot. The outliner and inspector panes start as empty placeholders and are filled by US2/US4. Wire `useEditorShortcuts` to the overlay methods.
- [X] T028 [US1] Replace the content of `src/stage/components/Visualization.vue` with `<SceneEditor />` filling the available height. Remove the "Load Scene" button, its `chooseAndReadFile` call and `loadScene` (FR-007). Check that `src/views/Stage.vue`'s `.content` lets the editor take the full height (`flex: 1; min-height: 0`).

**Checkpoint**: Quickstart scenario 1 passes in browser and Electron. Switching tabs 10× leaves no extra WebGL contexts.

---

## Phase 4: User Story 2 – Place and arrange fixtures directly in 3D (Priority: P1)

**Goal**: Click to select, highlight and label objects. Move/rotate them with handles and snapping, edit values live in the inspector, give LED strips endpoint handles, create fixture visualizations from the editor, and keep the selection in sync with the Fixtures list.

**Independent Test**: Add a moving head and a spot visualization to two fixtures, position both on the stage using only the mouse, reload the project, and confirm the placement persists (quickstart scenarios 2–4).

- [X] T029 [US2] Add picking to `src/scene/editor/editorOverlay.ts`. On `pointerup` with < 4 px movement since `pointerdown` and no handle drag: raycast (`THREE.Raycaster`) against the scene root, skipping editor helpers, objects that are not effectively visible, and locked objects. Resolve the hit upwards to the nearest `userData.sceneObjectId`. Plain click → `store.select([id], "replace")`; Ctrl/Shift+click → `"toggle"`; a click on empty space → `clearSelection()`. A double click focuses the selection. Remember the last pointer surface hit (point + normal) for "Add" placement (US3).
- [X] T030 [US2] Add the selection highlight and labels to `EditorOverlay`:
  - Watch `store.selection` and keep one `THREE.BoxHelper` per selected object on the editor layer (active object `#ffcc00`, others `#4fc3f7`), updated every frame.
  - Labels: `CSS2DRenderer` (from `three/examples/jsm/renderers/CSS2DRenderer.js`) over the canvas, with one `CSS2DObject` per object showing its name at the top of its bounding box. Shown only when `settings.showLabels` is on; the selected object's label is always shown (FR-021).
  - Fixture visualization proxies from `createEditorProxy()` are pickable.
- [X] T031 [US2] Add the transform handles to `EditorOverlay` (research R7, single selection first):
  - `TransformControls` (from `three/examples/jsm/controls/TransformControls.js`; r176 API, so add `controls.getHelper()` to the scene) attached to the active object's `Object3D` when it is unlocked and visible. Mode comes from `store.transformMode`; space comes from `settings.transformSpace`.
  - Disable `OrbitControls` while dragging (`dragging-changed`).
  - On `mouseDown`, capture the before-states.
  - On `objectChange`, read the `Object3D`'s local position/rotation/scale, convert with `fromMatrix` (scale clamped to "each component ≥ 0.01", no negatives), and call `store.previewTransforms`, throttled to one call per animation frame.
  - On `mouseUp`, call `store.commitPreview(before, "Move" | "Rotate" | "Scale")`.
  - Escape during a drag calls `store.cancelPreview(before)` and resets the `Object3D`.
- [X] T032 [US2] Add snapping to `EditorOverlay`. When `settings.snapEnabled` is set, call `setTranslationSnap(settings.translationSnap)`, `setRotationSnap(THREE.MathUtils.degToRad(settings.rotationSnap))` and `setScaleSnap(settings.scaleSnap)`, otherwise `null`. Holding Ctrl during a drag inverts the snapping state (listen to `keydown`/`keyup` and reapply the snaps); FR-023.
- [X] T033 [US2] Extend `src/scene/editor/EditorToolbar.vue` with:
  - Move/Rotate/Scale toggle buttons (`store.transformMode`) and a World/Local toggle (`settings.transformSpace`).
  - A snapping toggle, plus `InputNumber`s for the translation step (m, > 0) and rotation step (°, > 0).
  - A Labels toggle.
  - Wire the shortcuts `W`/`E`/`R`, `Q`, `Shift+S` and `Escape` (cancel drag, else clear selection) in `SceneEditor.vue`.
- [X] T034 [P] [US2] Create `src/scene/editor/inspector/TransformFields.vue`, with `InputNumber` rows for position (m, 3 decimals), rotation (°, 1 decimal) and scale (3 decimals, min 0.01). Values apply on every input event via `store.previewTransforms`. One history entry is committed on blur or Enter (`commitPreview`), and spinner steps merge into one entry while the field keeps focus (contracts/editor-ui.md → Inspector). For a multi-selection, show the active object's values and apply the edited component to all selected objects.
- [X] T035 [US2] Remove the placement fields and "Apply" buttons from the settings components, which become live-binding components used by the inspector and by `FixtureSettings.vue`:
  - `src/visualization/fixtureVisualizations/ledStrip/LedStripVisualizationSettings.vue`: keep `intensity`, plus `start`/`end` labelled "(local, m)"; remove direction and the Apply button / `dirty` logic.
  - `src/visualization/fixtureVisualizations/spot/SpotVisualizationSettings.vue`: remove position/target.
  - `src/visualization/fixtureVisualizations/movingHead/MovingHeadVisualizationSettings.vue`: remove position/rotation.
  - Each component emits `update:config` on every change.
- [X] T036 [US2] Create `src/scene/editor/inspector/FixtureVisualizationProperties.vue`:
  - A "Linked fixture" `Select`: "None" plus the fixtures of a compatible type that have no visualization object yet, plus the current one. Assigning a fixture already linked elsewhere shows the error toast "<fixture> already has a visualization." (data-model invariant 3).
  - A "Visualization type" `Select`. Changing it calls `updateObjects` with the new `visualizationType` and that type's `defaultConfig(fixture)` while keeping id, name, transform and parent (spec edge case).
  - The type's settings component, with `config` bound through `store.updateObjects` (one history entry per change, merged while a field keeps focus).
  - An "Open fixture settings" button, enabled only when linked (FR-025; behavior in T041).
- [X] T037 [US2] Create `src/scene/editor/Inspector.vue`:
  - Shows "Nothing selected" or a header with the editable name (`store.rename` on blur/Enter; empty names rejected per data-model "Non-empty after trimming"), a kind chip, `TransformFields`, and the per-kind component chosen by narrowing on `kind` (`FixtureVisualizationProperties` now; `ShapeProperties` and `ImportedModelProperties` are added in US3/US7; unknown kinds show "Created by a newer version – only transform can be edited").
  - Mount it in the inspector pane of `SceneEditor.vue`.
- [X] T038 [US2] Add LED strip endpoint handles to `EditorOverlay` (FR-027, research R7). When exactly one LED strip `fixtureVisualization` object is selected, show two small spheres (r 0.05 m) at its local `start`/`end`. Clicking a sphere attaches a second, translate-only `TransformControls` to it (the main controls detach). Dragging previews `config.start`/`config.end` in object-local coordinates via `store.updateObjects` without history, and commits one entry "Move strip endpoint" on mouseUp. Rotating the object changes the light direction (local +Y).
- [X] T039 [US2] Create `src/scene/editor/AddFixtureVisualizationDialog.vue`, a PrimeVue `Dialog` with a fixture `Select` (only fixtures without a visualization object) and a visualization type `Select` (only types whose `compatibleFixtures` include the fixture type). On confirm, the store command `addFixtureVisualization(fixtureId, type, placement?)` creates the object with the default config, named after the fixture and placed at the last surface hit (or the origin). Add the store command to `src/scene/sceneStore.ts`, and add an "Add" menu to `EditorToolbar.vue` with the "Fixture visualization…" entry (FR-031).
- [X] T040 [US2] Update `src/stage/components/FixtureSettings.vue`. The Visualization `Select` reads its type from the scene object linked to this fixture. Choosing a type when there is no object calls `addFixtureVisualization` (placed at the origin). Changing the type updates the object as in T036. Choosing "None" removes the object (undoable, fixture kept). The settings component binds to the object's `config` via the store. Remove all use of the removed `visualization.setVisualization`.
- [X] T041 [US2] Implement cross-view selection (FR-026):
  - Add a small shared UI state, `src/views/stageViewState.ts` (`activeTab` ref, `selectedFixtureId` ref), and use it in `src/views/Stage.vue` instead of the local `selectedTab`.
  - `src/stage/components/Fixtures.vue`: drive `selectedFixture` from `selectedFixtureId`. Selecting a fixture also selects its linked visualization object in `useScene` (if one exists).
  - Selecting a linked visualization object in the editor sets `selectedFixtureId`.
  - "Open fixture settings" sets `selectedFixtureId` and `activeTab = 0` (Fixtures).

**Checkpoint**: Quickstart scenarios 2 (handles, inspector, snapping), 3 and 4 pass in both targets. Placement survives save/reload. US1 + US2 together form the MVP.

---

## Phase 5: User Story 3 – Build the static stage from basic shapes (Priority: P2)

**Goal**: Add box, cylinder, plane and sphere shapes; size, color, scale, name and place them; they persist and are included in stage export/import.

**Independent Test**: In a new project, build a platform (box), a back wall (plane) and a table (box) with distinct colors. Save, close and reopen the project, and confirm the scene is identical (quickstart scenarios 2 and 10).

- [X] T042 [US3] Add to `src/scene/sceneStore.ts` a command `addShape(shape, placement?)`, which uses `createShapeObject` and `nextObjectName`. Placement: when the last pointer surface hit exists, the position is the hit point. Box, cylinder and plane need no offset (their origin is at the bottom); a sphere is lifted by its radius along the hit normal. Without a hit, place at `[0, 0, 0]` (sphere at `[0, r, 0]`). The new object becomes the only selection (FR-030).
- [X] T043 [US3] Extend the "Add" menu in `src/scene/editor/EditorToolbar.vue` with Box, Cylinder, Plane, Sphere (and Group, which calls `addObjects([createGroupObject()])`), using the placement from T042. The editor overlay provides the last surface hit through an exposed getter.
- [X] T044 [P] [US3] Create `src/scene/editor/inspector/ShapeProperties.vue`, with the shape type read-only, dimension `InputNumber`s per shape in meters with "each ≥ 0.01" enforced via `min` (box width/height/depth; cylinder radius/height; plane width/depth; sphere radius), and a PrimeVue `ColorPicker` for the hex color (`#rrggbb`). Changes apply live via `store.updateObjects`, with one history entry per field edit as in T034. Below the fields, show "World size: … m" (dimensions × scale). Wire it into `Inspector.vue`.
- [X] T045 [US3] Verify and fix in `src/visualization/objectBuilders.ts` that updates to dimensions and color rebuild or modify only the affected geometry/material and dispose the old geometry. Check that scale-mode handles (T031) resize shapes along one axis, and that every shape receives LED strip light in its own color.
- [X] T046 [US3] Check stage export/import in `src/views/Stage.vue`: export contains `scene` (via `stage.save()`), and import replaces the scene (T019). Fix anything missing so quickstart scenario 10 passes for shapes.

**Checkpoint**: Quickstart scenario 2 (shapes part) and the shapes part of 10 pass in both targets.

---

## Phase 6: User Story 4 – Organize the scene: outliner, grouping, mounting, editing safety (Priority: P2)

**Goal**: An outliner tree with rename/hide/lock/reparent; multi-selection transforms; duplicate, copy/paste and delete; undo/redo for all editing actions.

**Independent Test**: Create a box "Truss", attach three moving heads to it via the outliner, move the box and confirm the fixtures follow; undo the move and confirm everything returns (quickstart scenarios 5 and 6).

- [X] T047 [US4] Create `src/scene/editor/Outliner.vue` with a PrimeVue `Tree` built from `rootOrder` and `children` (a computed node list with `key = id`):
  - Each row shows a kind icon, the name, and eye (visibility, `store.setVisible`) and lock (`store.setLocked`) icon buttons.
  - Clicking a row selects (Ctrl/Shift toggles) and stays in sync with the editor selection both ways, including selecting locked objects (spec US4 #5).
  - Double click or F2 starts an inline rename (non-empty after trimming).
  - Hidden objects are greyed out but listed.
  - Mount it in the outliner pane of `SceneEditor.vue`.
- [X] T048 [US4] Add drag & drop reparenting to `src/scene/editor/Outliner.vue`, using native HTML5 drag events on the row templates (PrimeVue `Tree` DnD is not relied on). Dropping on a row calls `store.reparent(selectedOrDraggedIds, targetId)`; dropping on the empty area / root zone calls `reparent(ids, null)`; dropping between rows reorders via the `index` argument. Cycles are rejected silently (`wouldCreateCycle`). The world transform is kept (FR-033), with one history entry "Reparent".
- [X] T049 [US4] Add multi-selection transforms to `src/scene/editor/editorOverlay.ts` (research R7). With 2+ selected unlocked objects, attach `TransformControls` to a temporary pivot `Object3D` at the center of the selection's world bounding box (oriented like the active object in local space). On drag, compute the pivot delta `D = pivotNow × inverse(pivotStart)` and, for each selection root (`getSelectionRoots`), set the world matrix `D × worldStart`, convert to local with the parent's inverse world matrix, and preview it. Commit one history entry on mouseUp (spec US4 #3).
- [X] T050 [US4] Add to `src/scene/sceneStore.ts`:
  - `duplicateSelection()`: deep-copies the selected subtrees with new ids, preserving the internal hierarchy, offsets the roots by +0.25 m on X, sets `fixtureId = null` on copied fixture visualizations (FR-034), appends " copy" to the root names, selects the copies, and records one history entry.
  - `copySelection()`: in-memory clipboard of subtree states (research R14).
  - `pasteClipboard()`: like duplicate, from the clipboard, with new ids and links removed.
  - `deleteSelection()`: `removeObjects` including descendants, one history entry, fixtures never deleted (FR-035).
  - `selectAll()`: pickable objects only.
- [X] T051 [US4] Wire the US4 actions:
  - Shortcuts in `src/scene/editor/SceneEditor.vue`: `Delete`/`Backspace`, `Ctrl+D`, `Ctrl+C`, `Ctrl+V`, `Ctrl+A`, `H` (toggle visibility of the selection), `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`, `F2`.
  - Undo/Redo buttons in `EditorToolbar.vue`, disabled per `canUndo`/`canRedo`.
  - A selection context menu (PrimeVue `ContextMenu`) on right click without drag in the viewport and on outliner rows, with the entries from contracts/editor-ui.md → Menus that exist so far: Duplicate, Copy, Paste, Delete, Hide/Show, Lock/Unlock, Focus, Unparent, Open fixture settings. Align/Distribute come in US8.
- [X] T052 [US4] Implement "undo cancels a running drag" in `src/scene/editor/editorOverlay.ts` + `SceneEditor.vue`. If a handle or endpoint drag is active when undo is triggered, call `cancelPreview(before)`, reset the `Object3D`s and end the drag without changing the history (spec edge case). Also make sure that undo/redo while `TransformControls` are attached re-syncs the attached object or pivot from the new state.
- [X] T053 [US4] Verify the hidden/locked semantics end to end. Hidden objects and their descendants are invisible in the editor and the show window (the `visible` flag is sent; `SceneView` uses `isEffectivelyVisible`). Locked objects are excluded from picking and get no handles in 3D, but stay selectable and editable in the outliner and inspector. Fix the gaps in `src/visualization/sceneView.ts` and `src/scene/editor/editorOverlay.ts`.

**Checkpoint**: Quickstart scenarios 5 and 6 pass in both targets, including undo/redo of every action type listed in FR-040.

---

## Phase 7: User Story 5 – Show window on a second screen (Priority: P2)

**Goal**: The separate window shows the same scene without editing aids, follows edits within 0.5 s, has its own camera, and works when opened late or twice.

**Independent Test**: Open the show window, move an object in the editor and confirm it moves in the show window within a moment. Confirm the show window has no editing aids (quickstart scenario 9, first half).

- [X] T054 [US5] Fix "Open Visualizer" in `src/components/MainToolbar.vue` so the URL is relative to the app base: `new URL("visualization.html", window.location.href).href` instead of `"/visualization.html"`. This makes it work under the GitHub Pages base path and in Electron (`base: "./"`). Check that the Electron `setWindowOpenHandler` in `electron/electron.ts` still allows the window.
- [X] T055 [US5] Harden `src/scene/sceneSink.ts` `BroadcastSceneSink` and `src/visualization/showWindowClient.ts` for several windows and late opening. Each `hello` gets its own `snapshot` (`target = windowId`) followed by its assets. Windows ignore `snapshot`/`asset` messages for other ids. After project load/reset, every known window gets `reset` + `snapshot`. Fixture values are included in the snapshot, so a late window shows the current fixture states (US5 #4).
- [X] T056 [US5] Verify in `src/visualization/StageView.vue` / `sceneView.ts` that the show window renders no grid, axes, handles, selection boxes, labels or editor proxies (`showEditorProxies: false`, nothing on the editor layer), and that no input in the show window can change the scene (FR-050). The camera is local only (FR-052).
- [X] T057 [US5] Measure the latency: with the show window open, drag an object and confirm the show window follows within one or two frames (FR-051 / SC-005: "within 0.5 seconds"). If batching causes visible lag, flush `objectsChanged` immediately when there are no further changes queued. File: `src/scene/sceneSink.ts`.

**Checkpoint**: Quickstart scenario 9 (show window part) passes, and open/close 10× (scenario 12, show window part) shows no slowdown.

---

## Phase 8: User Story 6 – Saved camera positions (Priority: P3)

**Goal**: Save named camera positions and switch between them in the editor and the show window. One position can be the show default. They persist with the project.

**Independent Test**: Save two camera positions, switch between them in both windows, reload the project, and confirm they persist (quickstart scenario 9, second half).

- [X] T058 [US6] Add the camera commands to `src/scene/sceneStore.ts`, all without history (FR-040 covers objects only), each notifying sinks via `camerasChanged`: `saveCameraPosition(name, pose)` (name non-empty; `target` must differ from `position`; fov clamped to 10–120), `renameCameraPosition(id, name)`, `deleteCameraPosition(id)`, and `setShowDefault(id | null)`, which clears `isShowDefault` on all others ("At most one has `isShowDefault: true`").
- [X] T059 [US6] Create `src/scene/editor/CameraMenu.vue`, a toolbar dropdown listing the saved positions. Clicking one animates the editor camera to it (`EditorOverlay.setCameraPose`, animated 250 ms). It also offers "Save camera position…" (a name prompt `Dialog`; uses the overlay's current pose), and rename, delete and "Use as show window default" per entry (a star icon marks the default). Add it to `EditorToolbar.vue`.
- [X] T060 [US6] Add the camera list to the show window in `src/visualization/StageView.vue`: a top-right overlay menu, auto-hidden after 3 s without mouse movement, listing the positions from the snapshot/`camerasChanged`. Selecting one moves only that window's camera. On start, use the show default, else the first position, else `editorCamera` (data-model → Camera Position).

**Checkpoint**: Quickstart scenario 9 (camera part) passes. Camera positions survive save/reload and stage export/import.

---

## Phase 9: User Story 7 – Import a custom 3D model (Priority: P3)

**Goal**: Import a GLB file as one scene object with its materials and textures, stored inside the project.

**Independent Test**: Import a textured model file, place and scale it, save and reopen the project, and confirm it renders identically in the desktop and the browser version (quickstart scenarios 8 and 10).

- [X] T061 [US7] Create `src/scene/editor/modelImport.ts` with `importModelFile()` (research R10):
  - Use `getNativeAdapter().chooseAndReadFile({ accept: [{ name: "3D Model (GLB)", extensions: ["glb"] }] })`.
  - If the file is larger than 20 MB, confirm first with the dialog text from contracts/editor-ui.md → Messages.
  - Parse with `GLTFLoader.parseAsync(data.buffer, "")`. Reject `.gltf` JSON or external references. On any error, show the toast "Could not import model: <reason>" and leave the scene unchanged (FR-037).
  - Compute the bounding box. If the largest side is > 50 m or < 0.01 m, auto-scale it to a 10 m largest side, keep `originalScale = [1,1,1]`, and show the info toast "Model was scaled to fit (factor <f>)…".
  - Call the store command `addImportedModel(asset: SceneAsset, name, scale, placement?)`, which adds the asset to the store's asset map and the object (`assetId`, `originalScale`) in **one history entry** (undo removes the object; the asset is GC'd on save). Notify sinks with `asset` before `objectsChanged`.
  - Add the command to `src/scene/sceneStore.ts`.
- [X] T062 [US7] Implement the `importedModel` builder in `src/visualization/objectBuilders.ts` + `src/visualization/sceneView.ts`:
  - Parse the asset bytes with `GLTFLoader` once per `assetId` (cache the parsed scene and clone it per object).
  - Convert the materials with `convertToLedLit` (T011) so textures and colors are preserved and LED strips light the model.
  - While the asset bytes are missing (show window), show the loading placeholder.
  - When parsing fails at load time, show the red wireframe placeholder labelled "Model could not be loaded" without affecting the rest of the scene (FR-061).
  - Dispose the cloned materials/geometries and cached textures when the last object using an asset is removed.
- [X] T063 [P] [US7] Create `src/scene/editor/inspector/ImportedModelProperties.vue`, which shows the file name and size (from the asset) and a "Restore original scale" button (`updateObjects` with `scale = originalScale`, one history entry). Wire it into `Inspector.vue`, and add "Import model (GLB)…" to the Add menu in `EditorToolbar.vue`.
- [X] T064 [US7] Verify the persistence of imported models in `src/scene/sceneStore.ts` `save()`/`load()` and `src/scene/model/assets.ts`. Assets are written base64 into `stage.scene.assets`, restored to `Uint8Array` on load, sent to show windows as `ArrayBuffer`, and removed on save when no object or history entry references them. Check with a ~20 MB model that save/load still finishes and the project file grows as expected.

**Checkpoint**: Quickstart scenario 8 and the model part of 10 pass in both targets.

---

## Phase 10: User Story 8 – Distribute and align objects (Priority: P3)

**Goal**: Align selected objects on one axis to the active object, and distribute 3+ objects evenly along an axis.

**Independent Test**: Place 8 fixtures roughly along a line, use "Distribute evenly" and "Align", and confirm equal spacing and identical height (quickstart scenario 7).

- [X] T065 [P] [US8] Add to `src/scene/model/transformMath.ts`: `alignToActive(scene, ids, activeId, axis: "x" | "y" | "z")`, which returns new local transforms so that every object's **world** position on `axis` equals the active object's world position on that axis. Add `distributeEvenly(scene, ids, axis)` (requires ≥ 3 ids): sort by world position on `axis`, keep the outermost two, and space the others equally between them in world space. Both work on world positions and convert back to local per object (parents may differ).
- [X] T066 [US8] Add the store commands `alignSelection(axis)` (≥ 2 selected) and `distributeSelection(axis)` (≥ 3 selected) to `src/scene/sceneStore.ts`, each one history entry ("Align Y", "Distribute X"). Add "Align ▸ X/Y/Z to active" and "Distribute ▸ X/Y/Z" to the context menu (T051) and as a toolbar dropdown in `EditorToolbar.vue`, disabled when too few objects are selected.

**Checkpoint**: Quickstart scenario 7 passes. Align and distribute are undoable.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Leaks, performance, cleanup and the full verification across all stories.

- [ ] T067 Do a leak pass (FR-062, SC-006). Switch the Visualization tab 10×, open/close the show window 10× and load another project 10×. Check in DevTools that the WebGL context count stays constant, that there's no "Too many active WebGL contexts" warning, that heap snapshots show no retained `SceneView`/`WebGLRenderer`, and that no previous scene keeps rendering. Fix the disposal gaps in `src/visualization/sceneView.ts`, `src/visualization/objectBuilders.ts`, `src/scene/editor/editorOverlay.ts` and `src/scene/editor/Viewport.vue`.
- [ ] T068 Do a performance pass (SC-004). Build a scene with 200 objects including 50 fixture visualizations (duplicate + assign), then orbit and drag while recording fps. If the real `SpotLight` count is the bottleneck, add the fallback cap of 16 real spotlights per view in `src/visualization/sceneView.ts` (further spot/moving-head renderers keep their beam but get `spotlight.visible = false`), as decided in research R15. Record the reference machine (hardware, browser and Electron version) and the measured fps in `specs/001-scene-editor/quickstart.md` under "Recording results".
- [X] T069 [P] Remove the leftovers: `src/visualization/stageRenderer.ts` (if still present), `src/visualization/modifiedStandardMaterial.ts`, the `ledStripInstanceManager` singleton, the test pages `src/visualization/fixtureVisualizations/ledStrip/test.html`, `test.js` and `spot/test.html` if they reference removed APIs, and the unused Comlink import in `src/visualization/StageView.vue`. Search with `rg "baseScene|loadScene|setVisualization|visualizationStates|ledStripInstanceManager" src` and clean every hit except `src/scene/model/legacy.ts`.
- [X] T070 [P] Remove the remaining `as any` in `src/visualization/sceneView.ts`, `src/visualization/visualizationServer.ts` and `src/visualization/fixtureVisualizations/factory.ts`, or give each a reason comment (constitution II).
- [X] T071 Run the quality gates `pnpm lint` and `pnpm build`, plus `pnpm build:for:electron` / `pnpm electron:dev`, and fix all errors.
- [ ] T072 Run the full manual verification: spec.md → Manual Verification steps 1–10 and quickstart.md scenarios 1–14, in **both** the browser and the Electron build. Record the results and deviations.
- [ ] T073 Commit to `main` with a message that states the breaking change required by constitution IV: "Projects saved before this change lose their static stage scene (not migrated); fixture visualization placements are converted where possible. Scene file import ('Load Scene') was removed."

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. **Blocks all user stories.** It ends with a working show window and round-tripping save/load, so `main` stays usable.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on US1 (viewport, overlay, editor layout).
- **US3, US4, US5, US6, US7**: each depends on US2 (picking, handles, inspector, Add menu). They are independent of each other, except:
  - US4's multi-selection pivot (T049) and undo-cancels-drag (T052) extend code from US2 (T031).
  - US7's "Import model" menu entry uses the Add menu from US2/US3 (T039/T043).
- **US8 (Phase 10)**: depends on US4 (multi-selection and context menu, T049/T051).
- **Polish (Phase 11)**: after all desired stories.

### User Story Dependencies (graph)

```text
Setup → Foundational → US1 → US2 ─┬─► US3
                                  ├─► US4 ──► US8
                                  ├─► US5
                                  ├─► US6
                                  └─► US7
                                              all ──► Polish
```

### Within Each Phase

- Pure model modules (T004–T009) before the store (T016).
- Renderer changes (T010–T013) before `SceneView` (T014), which comes before the sinks (T015) and the show window (T020).
- `editorOverlay.ts` is touched by many tasks (T022, T023, T029–T032, T038, T049, T052, T053). Do them sequentially; never mark two of them [P] together.
- `sceneStore.ts` is extended by T016, T039, T042, T050, T058, T061 and T066. Do them sequentially within their stories.

### Parallel Opportunities

- Phase 1: T003 in parallel with T002.
- Phase 2: T004, T005, T006, T007, T008 and T009 (separate pure modules) all in parallel, and T012 in parallel with T011 once T002 is done.
- US1: T024 (shortcuts composable) in parallel with T022/T023.
- US2: T034 (TransformFields) in parallel with the overlay tasks T029–T032.
- US3: T044 (ShapeProperties) in parallel with T042/T043.
- US7: T063 (inspector component) in parallel with T061/T062.
- US8: T065 (pure math) in parallel with any other story's work.
- Polish: T069 and T070 in parallel.
- After US2, US3/US5/US6/US7 can be worked on in any order. They touch mostly different files, except the shared `EditorToolbar.vue`, `Inspector.vue` and `sceneStore.ts` entries, which are small sequential edits.

---

## Parallel Example: Foundational phase

```text
Task: "T004 Create src/scene/model/defaults.ts (default scene, shape defaults, naming)"
Task: "T005 Create src/scene/model/transformMath.ts (world/local, reparent, cycles, visibility)"
Task: "T006 Create src/scene/model/history.ts (object-patch undo/redo, max 200)"
Task: "T007 Create src/scene/model/assets.ts (base64, asset GC helpers)"
Task: "T008 Create src/scene/model/sanitize.ts (tolerant load)"
Task: "T009 Create src/scene/model/legacy.ts (old visualization → scene objects)"
```

## Parallel Example: User Story 2

```text
Task: "T034 [US2] Create src/scene/editor/inspector/TransformFields.vue"
Task: "T035 [US2] Remove placement fields from the three *VisualizationSettings.vue components"
# meanwhile, sequentially in editorOverlay.ts: T029 → T030 → T031 → T032
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational. Checkpoint: show window renders the scene, and save/load works.
2. Phase 3 US1. Checkpoint: navigate the embedded editor.
3. Phase 4 US2. **STOP and VALIDATE**: quickstart scenarios 1–4 in both targets. This removes the main pain point (placing fixtures by typing coordinates) and is a shippable increment on `main`.

### Incremental Delivery

4. US3 (shapes) → validate scenarios 2/10 → commit.
5. US4 (outliner, hierarchy, undo) → validate 5/6 → commit.
6. US5 (show window polish) → validate 9 (show part) → commit.
7. US6 (cameras), US7 (model import), US8 (align/distribute), each validated and committed separately.
8. Polish: leak + performance pass, full verification, final commit with the breaking-change note.

Each commit to `main` must pass `pnpm lint` and `pnpm build` (constitution II). Because Phase 2 already moves the show window to the new protocol, `main` is never left without a working visualization.

---

## Notes

- [P] = different files, no dependency on unfinished tasks.
- Quote the constraints from data-model.md when implementing validation (scale ≥ 0.01, dimensions ≥ 0.01 m, fov 10–120, non-empty names, at most one show default, one visualization per fixture).
- Messages and shortcuts must match contracts/editor-ui.md exactly. The show window must match contracts/show-window-protocol.md.
- Avoid vague edits to shared files. When a task extends `sceneStore.ts`, `editorOverlay.ts`, `EditorToolbar.vue` or `Inspector.vue`, add only the parts that task names.
