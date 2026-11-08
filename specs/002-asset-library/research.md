# Research: Asset Library & Model Contract

**Feature**: 002-asset-library | **Date**: 2026-11-08 | **Plan**: [plan.md](./plan.md)

This document answers the plan's open technical questions. Each entry gives the decision, the reasons, and the alternatives that were rejected.

## Findings from the current code (after feature 001)

These facts shape most of the decisions below.

- `src/visualization/modelLibrary.ts` loads exactly one GLB (`public/3d-models/moving_head_lowpoly.glb`, 34 KB) by `fetch("3d-models/…")`. This relative fetch already works in the browser build, in the show window and in Electron (`base: "./"`).
- `MovingHeadRenderer` is hard-wired to the model: it looks up the nodes `base_001`, `yoke_001` and `head_001`, and it places the beam, cap and SpotLight at a fixed offset of `0.73` along the head's +Y. At rest (pan = tilt = 0) the beam points up (+Y), and the base stands on the local origin.
- `SpotRenderer` has no body. Its cone starts at the local origin and widens along local **−Y**, and it shows an editor-only cone proxy so the user can pick it.
- `LedStripRenderer` has no body either. It feeds `LedStripLighting` and shows an editor-only box proxy between `start` and `end`.
- Scene objects (`src/scene/model/types.ts`) have the kinds `shape`, `fixtureVisualization`, `importedModel` and `group`. Unknown kinds are kept as they are and shown as a red wireframe placeholder (`objectBuilders.ts`). `sanitizeScene` is tolerant and never throws.
- `SceneView` already caches parsed GLB models per asset id and reference-counts them. Clones share geometry and materials (`sharedResources`), and glTF materials are converted to LED-lit materials (`convertToLedLit`). The library loader reuses this pattern.
- The store places new objects with `Placement = { point, normal }` taken from the last surface hit (`editorOverlay.updateSurfaceHit`). Ctrl inverts grid snapping (FR-023 of 001).
- The show window gets scene objects through protocol v2 (`objectsChanged`, `snapshot`). Asset bytes travel only for `importedModel` (`asset` message).
- OFL fixture definitions (`open-fixture.ts`) have `categories` (most important first, a fixed list of 17 values), `physical.dimensions` in **mm** as `[width, height, depth]`, `physical.lens.degreesMinMax` and optional `matrix.pixelCount`. A mode can override `physical`.
- `src/library` already exists and belongs to the pattern/audio library. The new module needs a different name.
- No 3D asset in the repository has recorded credits. `moving_head_lowpoly.glb` was committed by the project author (`1f63d0f`, "moving head WIP").

---

## R1. Where asset definitions live

**Decision**: Asset definitions live in a typed **TypeScript catalog** in a new module `src/assetLibrary/`, which has no Pinia or Vue imports so the show window can use it as well. Each entry is an `AssetDefinition` (see [contracts/asset-catalog.ts](./contracts/asset-catalog.ts)): id, name, category, keywords, default size, base point, credits, preview path, a **source** (`glb`, `procedural` or `parametric`), and for fixtures a `FixtureModelDescription`.

The model contract points into the model **by node name** for the parts that move, which are the pan and tilt pivots. All other contract data is numbers in the frame of a named node: beam origin and direction, lens radius, emitters and mounting points.

**Rationale**: Parametric elements need functions (size, connection points and geometry depend on parameters), which JSON cannot hold. `vue-tsc` then checks the shape of every definition at build time (constitution II). Using node names for the moving parts works for GLB files as well as for procedural models. Numbers for everything else mean that model authors do not have to add marker nodes for each emitter cell.

**Alternatives considered**:
- *JSON sidecar per model*: no functions for parametric elements, and the shape is only checked at runtime.
- *glTF `extras` or marker empties for every contract item*: robust against edits in Blender, but the description is then hidden inside binaries and cannot be reviewed in a diff. Marker empties are still **allowed** as named nodes (for example `beam`) when that is easier for a GLB author.

## R2. How the models are made (sources and licensing)

**Decision**: **Procedural models are the default.** Most fixture and decoration models are built at runtime by small TypeScript builder functions from Three.js primitives (lathe, cylinder, rounded box, tube) using a shared builder kit. They are made for this project and are covered by the project's GPL-3.0 license. GLB files are used where a procedural model would look clearly worse (candidates: human figures, drum kit). Such files may only come from sources whose license is in the allow-list (R11): CC0 collections (Kenney, Quaternius, Poly Haven), QLC+ meshes (Apache-2.0), and models the project author makes in Blender.

The existing `moving_head_lowpoly.glb` is **removed** (decided by the project author on 2026-11-08), together with `public/3d-models/` and `src/visualization/modelLibrary.ts`. The procedural moving heads (spot, beam, wash) replace it, so there are still three models for the US2 test.

**Rationale**:
- About 45 assets are needed (19 fixtures, 15 decoration, 8 parametric, 4 shapes). A maintainer working alone cannot model them all by hand, and CC0 collections have no flame projectors, CO2 jets or cold spark machines (spec assumption).
- Procedural models add next to nothing to the download (SC-007). They give a consistent low-poly look and set the contract node names by construction. They also share one builder kit with the parametric elements (R5), which have to be generated in code anyway.
- Every GLB comes with a license that has to be checked. Keeping GLBs rare keeps the credit and license review small (FR-060).

**Alternatives considered**:
- *All GLB, authored in Blender*: best visual quality, but far too much modelling work, and every later fix needs Blender.
- *Generate GLB files with a Node script (three + GLTFExporter)*: the output is the same as the runtime builders but adds a build step, binary churn in git and a size cost, with no benefit.
- *GDTF Share manufacturer models*: unclear redistribution terms, excluded by the spec.

## R3. Rest pose and coordinate conventions for fixture models

**Decision**: All models use meters, +Y up, and stand on their **base point**, which is the local origin (spec FR-004). **Fixture models are authored standing**: base or bracket on the floor, and at pan = tilt = 0 the beam points **up (+Y)**. Hanging is a rotation of the whole object by 180° about its local X axis, done by truss snapping (R8) or by the user. The beam direction is given as a vector in the frame of its node. Moving parts rotate about one principal axis (`x`, `y` or `z`) of their node, and the node's origin is the pivot.

Projects saved with feature 001 have spot objects whose beam points along local −Y. When `sanitizeScene` finds a spot visualization without `modelId` (in other words, saved before 002), it turns the spot by a local 180° X rotation, so the beam keeps pointing where it did before. Moving heads already have the new rest pose.

**Rationale**: One rest pose for every fixture makes "hang below / stand on top" one rule for all of them, and it matches the existing moving head. The one-time fix for spots costs a few lines in `sanitize.ts` and keeps old projects visually the same, so no breaking change has to be declared.

**Alternatives considered**: *rest pose per model in the description*: more data, plus a special case in snapping and in the renderers. *Keep spots pointing down*: then a par can on the floor would stand on its lens.

## R4. Scene representation of library items

**Decision**:
- New object kind **`libraryAsset`** with `assetId`, `params` (only for parametric elements), `material`, `color`, `variant` and `size` (the size of the item's bounding box, kept up to date by the store; used for placeholders, FR-070). Fixture models are **not** placed as `libraryAsset`, because they are the body of a fixture visualization.
- `fixtureVisualization` gets `modelId` (asset id) and `modelScale` (uniform, 0.25–4, default 1). The body is drawn at `modelScale` inside the object, so the object's own transform, scale included, stays the user's. Switching the model changes only `modelId`, and `modelScale` too if the fixture has dimensions (FR-013, FR-015).
- `shape` gets `material` (preset id or `null`).
- Basic shapes in the library are catalog entries of source type `shape` that call the existing `addShape`. No new object kind is needed for them (FR-006).
- Dropping a **fixture model** from the library creates an **unlinked** fixture visualization (`fixtureId: null`), using the model's first compatible visualization type. Feature 001 already supports unlinked visualizations and linking them in the inspector.

Details: [data-model.md](./data-model.md), [contracts/scene-state-delta.ts](./contracts/scene-state-delta.ts).

**Rationale**: Scenes reference assets by id and never by content (FR-005). Keeping fixture bodies inside `fixtureVisualization` keeps the 001 invariants (one visualization per fixture, controller lookup by object id) and makes "switch model, keep everything else" a one-field change. A separate `modelScale` keeps auto-scaling apart from the scale the user sets.

**Alternatives considered**: *fixture visualization as a child of a `libraryAsset` body*: two objects for one fixture, and broken models when the user reparents only one of them. *Auto-scale through `scale`*: a model switch would then carry over a scale that was computed for the old model.

## R5. Parametric stage elements

**Decision**: Each parametric element is a definition with a parameter schema (`number` with min, max, step and unit, or `choice`), defaults, a pure `size(params)` function (no Three.js needed, so the store can call it), `connections(params)` / `mountingAreas(params)` functions, and a `build(params, kit)` function that returns geometry. Repeating structures repeat with a nominal module length: number of modules `n = max(1, round(L / module))`, module length `L / n`. That keeps each module within ±25 % of its nominal length (truss bay 0.5 m, stair rise ≤ 0.20 m with tread 0.28 m, curtain fold 0.2 m, platform legs at most every 2 m). The inspector builds its fields from the schema and limits values to their ranges (FR-032). Parameter changes go through `store.updateObjects` with a merge key, so dragging a number field creates one undo step.

Ranges: see [data-model.md](./data-model.md#parametric-element-parameters).

**Rationale**: A small amount of in-house code (about 50–150 lines per element) on top of `BufferGeometryUtils.mergeGeometries` (part of three's examples, already installed). There is no new dependency (constitution V).

**Alternatives considered**: *scaling a fixed mesh*: the spec forbids distortion. *A CSG or modelling library*: a new dependency that is not needed for boxes and tubes.

## R6. Loading, caching and draw calls (FR-071, SC-004)

**Decision**: Each `SceneView` owns an `AssetCache`. Its key is `assetId + paramsKey + variant + material + color`. The value is a **template** `Object3D` whose meshes are **merged per material** at build time, so a static asset has at most about 3 meshes. Instances are `clone(true)`, which shares geometry and materials. Entries are reference-counted like the existing `ModelCacheEntry` and disposed when the last user goes away. GLB templates are fetched once per view from `asset-library/models/<file>.glb`. Fixture renderers clone the template **without** merging the nodes that move (pan and tilt subtrees are merged separately).

Budget for SC-004 (300 objects, 60 fixtures, 100 copies of one decoration item): about 100 × 3 + 200 × 3 ≈ 900 draw calls plus beams. That is fine on WebGL2. If it is not, the next step is an `InstancedMesh` path for static assets used more than 20 times, measured during verification. It is **not** built up front (YAGNI).

**Rationale**: Merging gives most of the gain of instancing without the bookkeeping that instancing needs for picking and per-object transforms.

**Alternatives considered**: *InstancedMesh from the start*: picking, selection boxes and hierarchy (children of a truss) all become instance-index aware. That is too much for an uncertain gain.

## R7. Fixture renderers on top of the contract (FR-011, SC-005, SC-006)

**Decision**: A new `FixtureBody` class in `src/assetLibrary/fixtureBody.ts` turns an asset template and its `FixtureModelDescription` into: the cloned body; `panNode` and `tiltNode` (found by name; rotation about the declared axis); `beamAnchor`, an `Object3D` added to the beam node at the declared position and oriented so its local +Z is the beam direction; and emitter meshes (a circle or rectangle per emitter, `MeshBasicMaterial`, `toneMapped: false`, so bloom picks them up). Renderers use only this API:

- `MovingHeadRenderer`: the body comes from the model. Pan and tilt drive `panNode` and `tiltNode`. Beam, cap and SpotLight hang on `beamAnchor`, and the beam radius comes from `lensRadius`. The fixed `0.73` offset and the node names go away.
- `SpotRenderer`: shows the body (par can by default) and puts its cone and light on `beamAnchor`. The editor-only proxy is removed, because the body can be picked.
- New `GenericRenderer` (new `VisualizationType.GENERIC = "Generic Fixture"`): body plus emitters whose color is `RGB(W) × intensity`. It is white when no color channel is mapped and full when no intensity channel is mapped (FR-022). All cells get the same value (FR-023).
- `LedStripRenderer`: gets a parametric body ("LED profile": aluminium channel with a diffuser) built between `start` and `end`. That body replaces the editor-only proxy box, and the endpoint handles stay.

A model is offered for a visualization type only if its description declares that type and it passes validation (R10). Moving head needs `pan`, `tilt` and `beam`. Spot needs `beam`. Generic needs at least one emitter. LED strip needs the `ledStrip` role.

**Rationale**: SC-006 says adding a model must not touch renderer code. Building the emitters from the description, instead of using emissive meshes inside the model, means a GLB does not need special materials, and later features can address each cell by emitter id.

**Alternatives considered**: *one renderer per category (LaserRenderer, FlameRenderer, …)*: feature 003 builds those. Building them now would be work that gets thrown away.

## R8. Mounting and connection snapping (FR-040–043)

**Decision**: A `SnapResolver` in `src/scene/editor/snapping.ts` works in world space on the descriptors of the objects in the scene:
- **Mounting areas** are `line` areas (a truss chord: start, end, tube radius, allowed modes `hang` / `stand`) and `surface` areas (the top of a platform: center, size, normal). They come from `mountingAreas(params)`.
- **Mounting points** of fixtures: position plus `direction`, the outward normal of the clamp face. Moving heads and pars have a point on the base (stand) that is also used for hanging when the fixture is flipped.
- **Connection points** of truss elements: position, outward direction, up vector and a `type` (for example `truss.square-290`). Only points of the same type connect, and only points that are free (no other connection point within 1 cm).

The resolver runs while an asset from the library is dragged over the viewport, and while a single fixture or truss element is moved with the translate gizmo. It looks for the nearest candidate within a **capture distance of 0.3 m** of the dragged item's mount or connection point. For a fixture under a chord it picks **hang** (flip 180° about X, mount point on the underside of the chord, yaw kept along the chord). For a fixture on top of a chord or a surface it picks **stand**. For a truss end it rotates the dragged segment so the connection directions point at each other with matching up vectors, then moves it so the points coincide. While the pointer moves, a candidate shows as a highlight and the preview jumps to it. On release, the object is committed and, for mounting, **reparented** to the mounted asset with its world transform kept (`store.reparent`). Holding **Ctrl** disables mount and connection snapping (FR-043; Ctrl is already the snapping modifier in 001).

**Rationale**: Descriptor-based, a single small module, and reuses existing store commands (`addObjects`, `reparent`, preview/commit).

**Alternatives considered**: *physics or collision based placement*: overkill. *Snapping only on drop, without a preview*: users cannot see where the item will land.

## R9. Library panel and drag & drop (FR-002, FR-003)

**Decision**: The left column of `SceneEditor` is split vertically: the outliner on top and the new **asset library panel** below (both resizable with splitpanes). The panel has a search field, collapsible category sections (Fixtures, Stage, Decoration, Basic shapes) and tiles (preview, name). Search is case-insensitive and matches substrings in name, category and keywords; every word typed must match (AND). Dragging a tile uses HTML5 drag & drop with the data type `application/x-lms-asset`. On `dragover` the viewport raycasts as it does for `updateSurfaceHit`, shows a **ghost** (the cached template on the editor layer) standing on the surface under the pointer (or on the floor at the origin if nothing is hit), and applies snapping (R8). On drop the store adds the object and selects it. Double-click or Enter on a tile adds the asset at the surface point in the viewport center, which also covers keyboard users.

**Rationale**: HTML5 drag & drop works the same in Electron and in the browser. The ghost reuses the asset cache.

**Alternatives considered**: *library as a tab next to the outliner*: hides the outliner while placing assets. *Own pointer-capture drag*: more code, and no native drag cursor.

## R10. Contract validation (FR-012, edge case "incomplete description")

**Decision**: One pure function `validateAsset(definition, template?)` in `src/assetLibrary/validate.ts` checks:
- metadata: unique id matching `^[a-z]+(\.[a-z0-9-]+)+$`, name, category, at least one keyword, preview file present, credits complete, license in the allow-list (R11);
- geometry: the built template's bounding box lies within ±15 % of `defaultSize` (per axis, at least 2 cm tolerance), its lowest point is at y = 0 ± 1 cm, and its size is between 5 cm and 20 m;
- fixture contract: every node named in the description exists, axes are valid, beam direction is a unit vector (±1 %), `lensRadius > 0`, emitter ids are unique and there is at least one emitter, at least one mounting point, and the declared visualization types meet the role requirements in R7;
- parametric elements: build at minimum, default and maximum parameters, and `size(params)` matches the built bounding box (±2 %).

It runs in three places:
1. **Asset workbench** (`asset-workbench.html`, dev server only, not part of the build): validates every asset, shows each one with its contract overlay (pivots, beam, emitters, mounting and connection points), plays a pan/tilt sweep, and renders the preview images (R12). The quickstart requires **all green** before a commit that touches assets. That is how "assets that fail validation are not shipped" is enforced.
2. **Dev startup** (`import.meta.env.DEV`): the catalog's metadata is validated and errors go to the console.
3. **Runtime safety net**: a fixture model that fails its geometry check when it is loaded is left out of model selectors, and a visualization that uses it falls back to the generic fixture model with a console error.

**Rationale**: The geometry checks need WebGL-free Three.js plus `GLTFLoader`, and `GLTFLoader` needs browser APIs for textures. A dev page in the browser is the simplest place that runs both procedural and GLB assets exactly as the app does. No test runner is added (constitution III, V).

**Alternatives considered**: *Node script with a headless GL or DOM shim*: new dependencies. *Vitest*: optional under the constitution, but it would also need DOM shims for GLB textures. Adding it later for `size()` and category mapping is possible.

## R11. Credits and license allow-list (FR-060, FR-061)

**Decision**: Every definition has `credits: { author, source, license, madeForProject }`. `license` is an SPDX id from the allow-list `GPL-3.0-or-later` (project-made), `CC0-1.0`, `CC-BY-4.0`, `Apache-2.0` and `MIT`. All of these may be redistributed in a GPL-3.0 application. CC-BY and Apache require attribution, and the credits view provides it. For Apache-2.0 assets the license text is shipped in `public/asset-library/LICENSES/`. The **Asset credits** dialog (opened from the library panel's header menu) lists every asset grouped by category, with author, source link, license, and "made for LEDMusic Studio" where that applies.

**Rationale**: Attribution sits next to each asset in a single source, so checking SC-008 is trivial (the validator enforces it).

## R12. Preview images

**Decision**: Previews are **pre-rendered** (spec assumption) as 256 × 256 WebP images with a transparent background, rendered by the asset workbench from a fixed three-quarter camera (fixtures in their rest pose, parametric elements at default parameters). "Render previews" packs them into a ZIP with `fflate` (already a dependency), which is unpacked into `public/asset-library/previews/<assetId>.webp`. Tiles load them lazily (`loading="lazy"`). If a preview is missing, which the validator reports, the tile shows a category icon.

**Rationale**: The panel opens instantly and needs no second WebGL context in the editor. About 45 × ~10 KB ≈ 0.5 MB.

**Alternatives considered**: *thumbnails rendered at runtime on first open*: always up to date, but adds a WebGL context and a delay on every app start.

## R13. Category-based preselection and auto-scaling (FR-014, FR-015)

**Decision**: `src/assetLibrary/categoryMapping.ts`. The definition's `categories` are walked **in order** and the first mapped category wins:

| OFL category | Visualization type | Default model |
|---|---|---|
| Moving Head | Moving Head | `fixture.moving-head-spot`; `fixture.moving-head-wash` if the fixture name contains "wash" or `lens.degreesMinMax[1] ≥ 25` |
| Scanner, Barrel Scanner | Moving Head | `fixture.scanner` |
| Color Changer, Dimmer | Spot | `fixture.par-can`; `fixture.wash-fresnel` if the name contains "wash" or "fresnel"; `fixture.profile-spot` if it contains "profile", "ellipsoidal", "leko" or "source four"; `fixture.led-bar` if `matrix.pixelCount` has more than one pixel or the name contains "bar" or "batten" |
| Pixel Bar | Generic | `fixture.pixel-bar` |
| Matrix | Generic | `fixture.led-panel` |
| Strobe | Generic | `fixture.strobe` |
| Blinder | Generic | `fixture.blinder` |
| Laser | Generic | `fixture.laser` |
| Smoke, Hazer | Generic | `fixture.fog-machine` |
| Effect, Flower, Fan, Stand, Other | Generic | `fixture.generic`; the name decides `fixture.flame-projector` ("flame", "fire", "gasprojector"), `fixture.co2-jet` ("co2", "cryo"), `fixture.cold-spark` ("spark", "sparkular"), then `fixture.led-bar` ("bar") and `fixture.par-can` ("par") |
| none / unmapped | Generic | `fixture.generic` |

Name matching is case-insensitive on `definition.name`. **Dimensions**: `mode.physical ?? definition.physical`, `dimensions = [width, height, depth]` in mm. They are used only if all three are between 30 mm and 3000 mm. In that case `modelScale = clamp(median(dim_i / 1000 / defaultSize_i), 0.25, 4)`; otherwise `modelScale = 1` (spec edge case). Then **Reset to model size** in the inspector sets `modelScale = 1`. The default channel mapping ranges for pan and tilt come from the model's `movingParts` limits when the visualization is created.

**Rationale**: Deterministic and small. The heuristics only choose a starting point, and the user can always pick another model.

## R14. Materials and color variants (FR-033, FR-050)

**Decision**: `src/assetLibrary/materials.ts` defines presets as parameter sets for the existing LED-lit material (`createLedLitMaterial`), which is extended with `sheen` and `clearcoat` (both `MeshPhysicalMaterial` properties):

| Preset | Color | Roughness | Metalness | Extra |
|---|---|---|---|---|
| Black stage floor | #141414 | 0.85 | 0 | — |
| Wood | #8a5a35 | 0.6 | 0 | — |
| Brushed metal | #b8bcc2 | 0.35 | 1 | — |
| Black fabric | #0e0e0e | 1 | 0 | sheen 1 |
| White fabric | #e8e8e8 | 1 | 0 | sheen 1 |
| Concrete | #8d8d8a | 0.95 | 0 | — |
| Glossy plastic | #d0d0d0 | 0.25 | 0 | clearcoat 1 |

No textures, so the download stays small. Choosing a preset sets `material` and resets `color` to the preset color in one command. The user can then pick any color, and the preset's surface parameters stay. Shapes and parametric elements keep a material per object. Procedural builders tag their meshes with material **slots** (`body`, `accent`, `metal`, `fabric`, …). A `material` preset replaces the `body` slot. Color variants (`variants: [{ id, name, slots: { body: "#…" } }]`) recolor slots on decoration assets.

**Rationale**: The visible difference between matte and shiny (US7) comes from roughness and metalness, not from textures.

## R15. Show window

**Decision**: No new message types. `libraryAsset` objects and the new fields travel in `snapshot` and `objectsChanged`, which already carry full object states. The show window imports `src/assetLibrary` and fetches GLB files itself from the same relative path, so asset bytes do not have to be sent. `PROTOCOL_VERSION` stays 2, because both windows always come from the same build.

## R16. Dependencies

**Decision**: No new runtime dependency. `three/examples/jsm/utils/BufferGeometryUtils` (merging), `GLTFLoader` and `fflate` (preview ZIP, workbench only) are already installed. The workbench is a second dev-only HTML entry that is not in `build.rollupOptions.input`.

## R17. Performance reference

**Decision**: The developer's reference machine recorded for 001 (research R15 of 001) is reused for SC-004. The 300-object test scene is built during verification (see [quickstart.md](./quickstart.md)). If it is not smooth, the fallback is R6 (instancing for heavily repeated static assets) and then fewer segments in procedural builders.
