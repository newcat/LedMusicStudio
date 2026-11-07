# Implementation Plan: Scene Model & 3D Scene Editor

**Branch**: `001-scene-editor` (feature directory; work is committed directly to `main` per project convention) | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-scene-editor/spec.md`

## Summary

Make the stage scene a first-class part of the project and edit it in an embedded 3D editor in the Stage → Visualization tab. The scene becomes plain, serializable data (`SceneState`: a flat map of named objects in a parent/child tree, with saved cameras, editor settings and embedded GLB assets) in a new Pinia store with a patch-based undo history. Fixture visualizations become scene objects; their position, rotation and target fields move out of the configs into the common object transform.

A shared `SceneView` class (Three.js) mirrors the state for both the embedded editor and the existing show window (`visualization.html`). The editor adds OrbitControls, TransformControls, picking, selection boxes, CSS2D labels, outliner and inspector. The show window gets the scene through a new structured-clone `BroadcastChannel` protocol (snapshot + per-frame patches). The old scene-file import is removed. Old projects load with a default floor, and their fixture placements are converted where possible. No new runtime dependency.

## Technical Context

**Language/Version**: TypeScript 5.8, Vue 3.5 (Composition API, `<script setup>`)

**Primary Dependencies**: three 0.176 (core + `examples/jsm`: OrbitControls, TransformControls, CSS2DRenderer, GLTFLoader, EffectComposer), three-custom-shader-material, Pinia 3, PrimeVue 4 (Tree, InputNumber, ColorPicker, Menu, Dialog, Toast), splitpanes, @vueuse/core, uuid. All are already installed.

**Storage**: project JSON file (`SavedState.stage.scene`) and stage export file (`.lms`). Imported GLB data is embedded as base64 in it. Files go through the existing native adapter.

**Testing**: no automated tests (constitution III). Manual verification per [quickstart.md](./quickstart.md) and the spec's procedure, in both targets. Quality gates: `pnpm lint`, `pnpm build`.

**Target Platform**: Electron 36 desktop app and the browser build (GitHub Pages), with WebGL2.

**Project Type**: desktop/web single-page application (single Vite project, two HTML entries: `index.html`, `visualization.html`).

**Performance Goals**: 60 fps while orbiting and dragging with 200 objects / 50 fixture visualizations (SC-004). Show window latency < 0.5 s (SC-005), in practice 1–2 frames.

**Constraints**: works identically in both targets (no native adapter changes needed). No WebGL context or memory leaks over repeated open/close/load (FR-062). Project file size grows with embedded models (warning > 20 MB).

**Scale/Scope**: one scene per project. About 10 new Vue components, about 12 new TS modules, 4 renderers and 3 settings components adapted. Hundreds of objects, not thousands.

**Open item (not blocking)**: the "developer's reference machine" for SC-004 is recorded during manual verification (research R15).

All technical unknowns are resolved in [research.md](./research.md) (R1–R17).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| **I. Two targets, one codebase** | Editor, show window, model import and save/load use only web APIs (WebGL, BroadcastChannel, structured clone) and the existing native adapter (`chooseAndReadFile`, `chooseAndWriteFile`, `writeFile`). No runtime checks or Electron calls in feature code. `visualization.html` stays a Vite entry in both builds. | ✅ Pass |
| **II. Typed boundaries & quality gates** | Scene format and show-window messages are typed (`contracts/scene-state.ts`, `src/visualization/protocol.ts`), and the main and show windows share the same types module. No Rust/bridge changes, so there are no bindings to regenerate. Untyped spots (`as any` in the renderer factory) get a reason comment or are removed by typed maps. `pnpm lint` and `pnpm build` are part of the done criteria. | ✅ Pass |
| **III. Manual verification** | The spec has a 10-step procedure for both targets; quickstart.md maps it to requirements and adds leak, performance and shortcut checks. | ✅ Pass |
| **IV. Free iteration before 1.0** | `StageState.visualization` is replaced by `StageState.scene`, so old static scenes are lost. The commit message MUST state this. A small converter keeps fixture placements (spec edge case). | ✅ Pass (breaking change declared) |
| **V. Simplicity first** | No new dependency (R16). Undo uses one generic object-patch mechanism instead of per-command classes (R4). One perspective camera instead of orthographic views (R6). BoxHelper instead of OutlinePass (R8). In-memory clipboard (R14). Models embedded in JSON instead of a new container format (R10). | ✅ Pass |

**Post-design re-check (after Phase 1)**: still passes. The design adds a store, a view class and editor components, with no extra layers beyond the `SceneSink` interface. That interface is needed because the same updates go to a local view and to remote show windows. Forward compatibility for feature 002 (unknown kinds preserved) costs a single pass-through branch, not a plugin system. Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-scene-editor/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R17
├── data-model.md        # Phase 1: entities, invariants, state transitions
├── quickstart.md        # Phase 1: run + validation scenarios
├── contracts/
│   ├── scene-state.ts           # persisted scene format
│   ├── show-window-protocol.md  # BroadcastChannel messages main ↔ show window
│   └── editor-ui.md             # menus, mouse, keyboard, inspector, messages
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── scene/                                # NEW: scene model + editor (main window only)
│   ├── index.ts
│   ├── model/
│   │   ├── types.ts                      # SceneState & object kinds (= contracts/scene-state.ts)
│   │   ├── defaults.ts                   # default scene, default shapes/configs, naming
│   │   ├── sanitize.ts                   # tolerant load: clamp, fix parents, keep unknown kinds
│   │   ├── legacy.ts                     # old StageState.visualization → scene objects (R11)
│   │   ├── transformMath.ts              # world/local conversion, reparent, align, distribute
│   │   ├── history.ts                    # object-patch undo/redo (R4)
│   │   └── assets.ts                     # base64 <-> Uint8Array, GC of unused assets
│   ├── sceneStore.ts                     # Pinia useScene: state, selection, commands, clipboard
│   ├── sceneSink.ts                      # SceneSink interface, BroadcastSceneSink (protocol v2)
│   └── editor/
│       ├── SceneEditor.vue               # layout: toolbar | outliner | viewport | inspector
│       ├── EditorToolbar.vue
│       ├── Viewport.vue                  # canvas host, creates SceneView + EditorOverlay
│       ├── Outliner.vue                  # PrimeVue Tree, drag & drop reparent, eye/lock
│       ├── Inspector.vue
│       ├── inspector/
│       │   ├── TransformFields.vue
│       │   ├── ShapeProperties.vue
│       │   ├── FixtureVisualizationProperties.vue
│       │   └── ImportedModelProperties.vue
│       ├── AddFixtureVisualizationDialog.vue
│       ├── CameraMenu.vue
│       ├── editorOverlay.ts              # OrbitControls, TransformControls, pivot, picking,
│       │                                 # BoxHelpers, CSS2D labels, grid/axes, strip handles
│       ├── useEditorShortcuts.ts         # R13, ignores focused inputs
│       └── modelImport.ts                # GLB read/validate/auto-scale (R10)
├── visualization/                        # rendering, shared by editor and show window
│   ├── sceneView.ts                      # NEW: replaces RenderingInstance/StageRenderer
│   ├── objectBuilders.ts                 # NEW: SceneObject → Object3D (shapes, group, model, placeholder)
│   ├── ledLitMaterial.ts                 # NEW: replaces modifiedStandardMaterial.ts (R9)
│   ├── protocol.ts                       # NEW: show-window message types (contract)
│   ├── showWindowClient.ts               # NEW: show-window side of the protocol
│   ├── StageView.vue                     # CHANGED: show window UI (camera menu, no "No scene")
│   ├── visualizationServer.ts            # CHANGED: controllers keyed by object id, fan-out to sinks
│   ├── fixtureVisualizationController.ts # unchanged API
│   ├── fixtureVisualizations/
│   │   ├── base.renderer.ts              # CHANGED: editor proxy hook, world-update hook
│   │   ├── ledStrip/*                    # CHANGED: local start/end, direction = local +Y, per-view manager
│   │   ├── spot/*                        # CHANGED: no position/target, emits local −Y
│   │   └── movingHead/*                  # CHANGED: no position/rotation in config
│   ├── stageRenderer.ts                  # REMOVED
│   └── modifiedStandardMaterial.ts       # REMOVED (→ ledLitMaterial.ts)
├── stage/
│   ├── stage.ts                          # CHANGED: StageState.scene, legacy conversion on load
│   └── components/
│       ├── Visualization.vue             # CHANGED: hosts SceneEditor; "Load Scene" removed
│       ├── Fixtures.vue                  # CHANGED: selection synced with scene store
│       └── FixtureSettings.vue           # CHANGED: visualization create/type via scene commands
├── views/Stage.vue                       # CHANGED: active tab in shared state ("Open fixture settings")
├── globalState.ts                        # CHANGED: reset/load clear history, emit scene reset
└── components/MainToolbar.vue            # CHANGED: open visualizer URL relative to base
```

**Structure Decision**: single Vite project. Scene state and editing UI live in a new `src/scene` module that only the main window imports. Rendering stays in `src/visualization`, which the show window bundle imports. `src/visualization` must not import Pinia stores or `src/scene/editor`; it depends only on `src/scene/model/types.ts`. This keeps the show window bundle small and stops editor code from leaking into it.

## Implementation Approach (high level, details go to tasks.md)

1. **Model first** (types, defaults, sanitize, history, transform math, legacy conversion), then the store with commands. Save/load is wired into `stage.ts` so the scene round-trips before any UI exists.
2. **SceneView + adapted renderers** so the existing fixture visualizations render from scene objects; switch the show window to protocol v2 (US1, US5 baseline).
3. **Embedded editor**: viewport with navigation, then picking, TransformControls, inspector and snapping (US1, US2 = MVP).
4. **Shapes and Add menu** (US3), then **outliner, hierarchy, multi-select, duplicate/copy/paste, hide/lock, undo UI** (US4).
5. **Cameras** (US6), **model import** (US7), **align/distribute** (US8).
6. Leak and performance pass (FR-062, SC-004), then the manual verification in both targets.

## Risks

| Risk | Mitigation |
|---|---|
| 50 real `SpotLight`s make SC-004 fail | Measure early (step 2). Fallback cap of 16 real lights per view (R15); the full solution is in feature 003. |
| LED strip shader limited to 8 strips | Unchanged from today; documented. Raising the limit belongs to feature 003. |
| TransformControls with multi-selection and nested objects | Pivot + root-only delta application (R7); covered by quickstart scenario 5/6. |
| Large embedded models slow down save/autosave | Size warning, GC of unused assets; ZIP container possible later (R10). |
| `vue-tsc` strictness with discriminated unions in inspector components | Narrow by `kind` in a parent component and pass typed props to per-kind components. |

## Complexity Tracking

No constitution violations. Nothing to justify.
