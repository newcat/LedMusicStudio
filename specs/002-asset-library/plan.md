# Implementation Plan: Asset Library & Model Contract

**Branch**: `002-asset-library` (feature directory; work is committed directly to `main` per project convention) | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-asset-library/spec.md`

## Summary

Add a built-in, offline **asset library** to the 001 scene editor and a **model contract** that separates the fixture visualizations from specific models.

- A typed catalog in a new module, `src/assetLibrary/` (no Pinia/Vue, so the show window uses it too), describes about 45 assets: 19 fixture models, 8 parametric stage elements, 14 decoration items and the 4 basic shapes. It gives each asset's size, base point, credits, preview, source and, for fixtures, a `FixtureModelDescription`. The description covers pan/tilt nodes and axes, the beam anchor, the lens radius, the emitters (individually addressable) and the mounting points.
- Most models are **procedural** (small TypeScript builders on a shared kit, merged per material slot). That keeps the download small and makes them project-made under GPL. GLBs are the exception. The existing `moving_head_lowpoly.glb` is removed and replaced by procedural moving heads.
- Scenes reference assets by id. There is a new object kind `libraryAsset`, and fixture visualizations gain `modelId` and `modelScale`. A new `FixtureBody` turns any valid model into pan/tilt nodes, a beam anchor and emitter meshes. On top of it, the moving head, spot and LED strip renderers drop their hard-coded geometry, and a new **Generic Fixture** visualization makes emitters glow for categories that do not have a dedicated effect yet.
- The editor gets a library panel (search, categories, previews) with HTML5 drag & drop and a ghost preview. Mount and connection snapping (truss chords, platform tops, truss ends) reparents fixtures to what they are mounted on.
- The inspector gets parameter fields, material presets, color variants and a model selector. Visualization type and model are preselected from the OFL category, and the model is auto-scaled from the fixture dimensions.
- Validation, previews and credits come from a dev-only **asset workbench** page plus one shared validator.
- No new dependency. No breaking change to the project format.

## Technical Context

**Language/Version**: TypeScript 5.8, Vue 3.5 (Composition API, `<script setup>`)

**Primary Dependencies**: three 0.176 (core, `GLTFLoader`, `BufferGeometryUtils`), three-custom-shader-material (LED-lit material, extended with sheen and clearcoat), Pinia 3, PrimeVue 4 (InputText, Select, InputNumber, ColorPicker, Dialog, Menu, Panel), splitpanes, fflate (workbench preview ZIP). All are already installed.

**Storage**: catalog data ships with the app (`src/assetLibrary`, `public/asset-library/{models,previews,LICENSES}`). Project files store only ids and parameters (`SavedState.stage.scene`, `formatVersion` stays 1, additive fields).

**Testing**: no automated tests (constitution III). Manual verification follows [quickstart.md](./quickstart.md) and the spec's procedure, in both targets. Before any asset commit, the asset workbench must show 0 errors. Quality gates: `pnpm lint`, `pnpm build`.

**Target Platform**: Electron 36 desktop app and the browser build (GitHub Pages), WebGL2.

**Project Type**: desktop/web single-page application. Single Vite project with the entries `index.html` and `visualization.html`, plus the dev-only `asset-workbench.html`.

**Performance Goals**: SC-004, smooth with 300 objects (60 fixture visualizations, 100 copies of one decoration item). Static assets have ≤ 3 meshes after merging by slot, and templates are shared per view (research R6).

**Constraints**: works offline in both targets (FR-001). Download growth ≤ 25 MB (SC-007; expected < 3 MB). Every license on the allow-list (FR-060). The fixture renderers contain no model-specific code (SC-006).

**Scale/Scope**: about 45 assets. About 30 new TS modules (catalog, kit, builders, loader, validator, mapping, snapping), about 8 new Vue components, and 4 renderers plus about 6 editor components changed.

**Open items (not blocking)**: whether the drum kit and the human figures are procedural or CC0 GLB is decided per asset during implementation by visual quality. Both routes are covered by the contract.

All technical unknowns are resolved in [research.md](./research.md) (R1–R17).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| **I. Two targets, one codebase** | Assets are bundled code (procedural) or static files fetched by relative URL, the same path `modelLibrary.ts` already uses in both targets. Drag & drop is HTML5. The credits dialog opens links through the existing native adapter / a normal link. No runtime checks or Electron calls in feature code. The workbench is dev-only and not part of either build. | ✅ Pass |
| **II. Typed boundaries & quality gates** | Catalog, model contract and scene additions are typed ([contracts/asset-catalog.ts](./contracts/asset-catalog.ts), [contracts/scene-state-delta.ts](./contracts/scene-state-delta.ts)), so `vue-tsc` checks every asset definition. No Rust or bridge changes, so there are no bindings to regenerate. `pnpm lint` and `pnpm build` are done criteria. | ✅ Pass |
| **III. Manual verification** | The spec has a 10-step procedure. quickstart.md maps it to 20 scenarios and adds the asset gate (workbench, 0 errors). | ✅ Pass |
| **IV. Free iteration before 1.0** | Format changes are additive. `sanitize` fills in defaults for 001 files and turns old spots around so they keep their aim (R3), so loading old projects does **not** break. Older builds show `libraryAsset` as an unknown-kind placeholder. No breaking-change notice is needed. If implementation drops the spot conversion, the commit message must say so. | ✅ Pass |
| **V. Simplicity first** | No new dependency (R16). One renderer base (`FixtureBody`) instead of one renderer per category (R7). Merging by slot instead of instancing (R6). Only a uniform `modelScale` (R4). No JSON schema or test runner. The validator is one pure function (R10). Extra pieces (builder kit, workbench page) are justified below. | ✅ Pass (see Complexity Tracking) |

**Post-design re-check (after Phase 1)**: still passes. The design adds one shared module (`src/assetLibrary`), one object kind and one visualization type. Snapping is a single resolver over descriptor data, and the inspector reuses the store's existing `updateObjects` / `reparent` / preview-commit commands. There is no plugin system: the "extensibility" of SC-006 is only the catalog entry plus its builder. The dependency rule from 001 holds: `src/visualization` and `src/assetLibrary` import no stores or editor code.

## Project Structure

### Documentation (this feature)

```text
specs/002-asset-library/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R17
├── data-model.md        # Phase 1: catalog + scene entities, ranges, inventory, load rules
├── quickstart.md        # Phase 1: run, asset gate, validation scenarios
├── contracts/
│   ├── asset-catalog.ts             # catalog, fixture model contract, mounting, validator API
│   ├── scene-state-delta.ts         # libraryAsset kind, modelId/modelScale, shape material, Generic config
│   ├── library-ui.md                # panel, drag & drop, snapping, inspector, credits, messages
│   └── fixture-model-authoring.md   # rules and checklist for adding assets
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── assetLibrary/                          # NEW: catalog + contract, shared by main and show window (no Pinia/Vue)
│   ├── index.ts
│   ├── types.ts                           # = contracts/asset-catalog.ts
│   ├── catalog.ts                         # AssetCatalog: all/get/search/modelsFor/defaultModelFor
│   ├── catalog/
│   │   ├── fixtures.ts                    # 19 fixture definitions + descriptions
│   │   ├── stage.ts                       # 8 parametric elements
│   │   ├── decoration.ts                  # 14 decoration definitions + variants
│   │   └── shapes.ts                      # 4 basic shapes (source "shape")
│   ├── builders/
│   │   ├── kit.ts                         # BuilderKit: box/cylinder/tube/lathe, mergeBySlot
│   │   ├── fixtures/*.ts                  # par, fresnel, profile, moving heads, scanner, strobe, blinder,
│   │   │                                  #   bars, panel, laser, flame, co2, spark, fog, generic
│   │   ├── decoration/*.ts
│   │   └── stage/*.ts                     # platform, stairs, truss (straight/corner/tower), backdrop,
│   │                                      #   wall, floor, led profile
│   ├── materials.ts                       # material presets, slot coloring, variants
│   ├── assetCache.ts                      # per-view template cache (GLB fetch, build, ref counting)
│   ├── fixtureBody.ts                     # description -> pan/tilt nodes, beamAnchor, emitter meshes
│   ├── categoryMapping.ts                 # OFL category/name/dimensions -> type, model, modelScale (R13)
│   ├── validate.ts                        # validateAsset (R10)
│   └── workbench/                         # dev-only page logic (asset-workbench.html)
│       ├── main.ts
│       └── Workbench.vue                  # list + validation, contract overlay, sweep, preview render/ZIP
├── scene/
│   ├── model/
│   │   ├── types.ts                       # CHANGED: LibraryAssetObject, modelId/modelScale, shape material
│   │   ├── defaults.ts                    # CHANGED: createLibraryAssetObject, default models
│   │   ├── sanitize.ts                    # CHANGED: load rules 1–4 (data-model.md), spot re-orientation
│   │   └── transformMath.ts               # CHANGED: compose local rotation (spot fix, hang flip)
│   ├── sceneStore.ts                      # CHANGED: addLibraryAsset, setAssetParams/material/variant,
│   │                                      #   replaceAsset, setFixtureModel, resetModelScale, preselection
│   └── editor/
│       ├── SceneEditor.vue                # CHANGED: left column split outliner | library
│       ├── library/
│       │   ├── AssetLibraryPanel.vue      # NEW: search, sections, tiles, header menu
│       │   ├── AssetTile.vue              # NEW
│       │   ├── AssetPicker.vue            # NEW: used by "Replace asset…"
│       │   └── AssetCreditsDialog.vue     # NEW
│       ├── assetDrop.ts                   # NEW: dragover ghost, surface placement, drop commit
│       ├── snapping.ts                    # NEW: SnapResolver (R8), used by assetDrop and editorOverlay
│       ├── editorOverlay.ts               # CHANGED: snapping during gizmo translate, highlight, status hint
│       ├── Viewport.vue                   # CHANGED: drag & drop events, status hint
│       ├── Inspector.vue                  # CHANGED: libraryAsset branch
│       ├── AddFixtureVisualizationDialog.vue  # CHANGED: preselection + model select
│       └── inspector/
│           ├── LibraryAssetProperties.vue # NEW
│           ├── ParameterFields.vue        # NEW: from ParamSpec
│           ├── MaterialField.vue          # NEW: preset + color (shapes and library assets)
│           ├── ShapeProperties.vue        # CHANGED: material
│           └── FixtureVisualizationProperties.vue # CHANGED: model select, model size
├── visualization/
│   ├── objectBuilders.ts                  # CHANGED: libraryAsset (async template), sized placeholder
│   ├── sceneView.ts                       # CHANGED: owns AssetCache; syncs libraryAsset; renderers get cache
│   ├── ledLitMaterial.ts                  # CHANGED: sheen/clearcoat params
│   ├── modelLibrary.ts                    # REMOVED (replaced by assetCache)
│   ├── fixtureVisualization.ts            # CHANGED: VisualizationType.GENERIC
│   └── fixtureVisualizations/
│       ├── base.renderer.ts               # CHANGED: inputs include asset cache + model id/scale
│       ├── movingHead/movingHead.renderer.ts  # CHANGED: FixtureBody, no node names / 0.73 offset
│       ├── spot/spot.renderer.ts          # CHANGED: body + beamAnchor, proxy removed
│       ├── ledStrip/ledStrip.renderer.ts  # CHANGED: profile body between start/end
│       └── generic/                       # NEW: generic.visualization.ts, generic.renderer.ts,
│                                          #   GenericVisualizationSettings.vue
├── stage/components/FixtureSettings.vue   # CHANGED: preselected model on type change / creation
public/
├── 3d-models/                             # REMOVED (moving_head_lowpoly.glb deleted, research R2)
└── asset-library/
    ├── models/                            # optional CC0 GLBs only (e.g. drum kit, figures)
    ├── previews/<assetId>.webp            # pre-rendered by the workbench
    └── LICENSES/                          # license texts for Apache-2.0 assets, if any
asset-workbench.html                       # NEW, dev-only entry (not in rollupOptions.input)
```

**Structure Decision**: single Vite project. Catalog, builders, contract and validation live in `src/assetLibrary`, which the show window bundle can import. It depends only on three and on type imports from `src/visualization/fixtureVisualization.ts` and the OFL types. Editor-only UI (panel, drag & drop, snapping, inspector) lives in `src/scene/editor`. `src/visualization` must still not import Pinia stores or editor code.

## Implementation Approach (high level, details go to tasks.md)

1. **Contract and catalog foundation**: types, catalog API, builder kit, material presets, asset cache, `validate.ts`, and the workbench page with validation and contract overlay. Build the first procedural moving head (`fixture.moving-head-spot`) with its description, because the moving head renderer needs a model as soon as the old GLB is gone.
2. **Scene model**: `libraryAsset` kind, fixture `modelId`/`modelScale`, shape `material`, sanitize load rules (including the spot fix), store commands; `objectBuilders`/`SceneView` render library assets and placeholders. Save/load round-trips before any UI exists.
3. **Renderers on the contract**: `FixtureBody`; moving head and spot switched over; the Generic Fixture visualization; the LED strip profile body (US2, US3 baseline). Delete `public/3d-models/moving_head_lowpoly.glb` and `modelLibrary.ts`. Check the procedural moving head in the workbench sweep.
4. **Library panel and drag & drop** with ghost and surface placement; basic shapes in the library (US1 = MVP together with step 3).
5. **Fixture models** (all FR-020 entries) and **category mapping + auto-scaling** in the dialog and Fixture Settings; the model selector in the inspector (US2, US3).
6. **Parametric stage elements** and the parameter inspector (US4), then **snapping** (US5).
7. **Decoration** with variants (US6), **material presets** (US7), **credits dialog** (US8).
8. Previews for all assets, a performance pass (SC-004, SC-007), and manual verification in both targets.

## Risks

| Risk | Mitigation |
|---|---|
| Procedural models look too crude | Shared kit with bevels and lathe profiles; the workbench allows quick visual iteration; GLB route for single assets (R2). |
| 100 copies × several meshes are too slow (SC-004) | Merge by slot (≤ 3 meshes); measure in step 8; instancing fallback (R6). |
| Snapping during gizmo translate conflicts with TransformControls | Resolve after the gizmo's `objectChange` and override the preview transform; commit through the existing preview/commit path. If it misbehaves, snap only at drag end (still meets FR-041/042). |
| Emitter glow for 60 fixtures × 64 cells costs draw calls | Merge the emitters of one fixture into one mesh with vertex colors while all cells share a value (FR-023 allows it); keep the ids in a side table for feature 003. |
| Old projects' moving heads look different after the GLB is removed | Expected and acceptable (principle IV): position, aim and mapping stay; only the body changes. Mention it in the commit message. |
| Spot re-orientation on load is wrong for unusual rotations | Done with quaternions in `transformMath` (local composition); quickstart scenario 16 checks aim. |

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Procedural builder kit (`builders/kit.ts`) + ~35 builder modules | About 45 assets need to be made by one maintainer, with GPL-compatible licenses and a small download (FR-020/030/031, FR-060, SC-007); the parametric elements need generators anyway. | Hand-modelled GLBs for everything: far more manual work, binary churn and license review; no CC0 sources exist for several required fixture types. |
| Dev-only asset workbench page | FR-012 requires validation before shipping; geometry checks need a browser (GLTFLoader); previews have to be rendered (spec assumption). | Node script: needs a DOM/GL shim (new dependency). Validating only at runtime: invalid assets would only be noticed by users. |
