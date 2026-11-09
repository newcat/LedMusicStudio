---

description: "Task list for feature 002: Asset Library & Model Contract"
---

# Tasks: Asset Library & Model Contract

**Input**: Design documents from `specs/002-asset-library/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: There are no automated test tasks: the spec doesn't ask for them, and constitution III makes manual verification the default. Every phase ends with a manual checkpoint from [quickstart.md](./quickstart.md). Every task that adds or changes an asset ends with the **asset gate**: the asset workbench (`/asset-workbench.html`) shows the asset without errors.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own. Work is committed directly to `main` (project convention). Every commit must pass `pnpm lint` and `pnpm build`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story from spec.md (US1–US8)
- Paths are relative to the repository root (single Vite project, see plan.md → Project Structure)

## Conventions every task must follow

- Units: meters, degrees, +Y up, floor at y = 0, Euler XYZ, transforms relative to the parent (001 conventions). The front of an asset faces +Z. The base point is the local origin: "the built geometry's lowest point is at y = 0 and the asset is horizontally centered on the origin" (data-model.md).
- Fixture models are authored **standing**, and at pan = tilt = 0 "the beam points **up (+Y)**". Hanging is a 180° rotation about local X (research R3).
- `src/assetLibrary/**` and `src/visualization/**` MUST NOT import Pinia stores, Vue components or anything from `src/scene/editor/**` or `src/scene/sceneStore.ts`. `src/assetLibrary` may import `three`, `three/examples/jsm/**`, `@/visualization/fixtureVisualization` (for `VisualizationType`) and **type-only** imports from `@/stage/fixtures/dmx/open-fixture`. The show window bundle depends on this.
- Three.js objects never go into reactive state. Use `markRaw` or keep them outside Vue.
- No new runtime dependencies (research R16).
- Every scene mutation from the UI goes through a `useScene` command, so undo and show-window sync keep working.
- Procedural builders follow [contracts/fixture-model-authoring.md](./contracts/fixture-model-authoring.md): kit primitives only, no textures, every mesh tagged with a slot, finished with `kit.mergeBySlot(root, movingPartNodeNames)`. Poly budget: "decoration ≤ 3 000 triangles, fixtures ≤ 5 000, and parametric elements ≤ 20 000 at their maximum parameters". Deterministic output.
- Every asset definition has `credits` with `madeForProject: true`, `license: "GPL-3.0-or-later"`, `author: "LEDMusic Studio contributors"` and `source: "LEDMusic Studio"`, unless it is a third-party GLB.
- Asset ids follow `^[a-z]+(\.[a-z0-9-]+)+$` and are never reused.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module skeleton, contract types and the dev-only workbench entry.

- [X] T001 Create the folder skeleton `src/assetLibrary/` with `catalog/`, `builders/fixtures/`, `builders/decoration/`, `builders/stage/` and `workbench/`, plus `src/assetLibrary/index.ts`, which re-exports `./types`, `./catalog`, `./materials`, `./assetCache`, `./fixtureBody`, `./categoryMapping` and `./validate` (add each export when its file exists). Create the empty folders `public/asset-library/models/`, `public/asset-library/previews/` and `public/asset-library/LICENSES/`, each with a `.gitkeep`
- [X] T002 Create `src/assetLibrary/types.ts` by copying every type from `specs/002-asset-library/contracts/asset-catalog.ts`. Import `VisualizationType` from `@/visualization/fixtureVisualization` as a value import (it is an enum) and `Fixture as OflFixture` from `@/stage/fixtures/dmx/open-fixture` as a type-only import. Keep `Vec3` compatible with `src/scene/model/types.ts`, so it can be re-exported from there instead of being redefined. Also export `ASSET_ID_PATTERN = /^[a-z]+(\.[a-z0-9-]+)+$/` and `ALLOWED_LICENSES: readonly License[] = ["GPL-3.0-or-later", "CC0-1.0", "CC-BY-4.0", "Apache-2.0", "MIT"]`
- [X] T003 [P] Create the dev-only entry `asset-workbench.html` at the repository root (a copy of the structure of `visualization.html`, title "Asset workbench", script `src/assetLibrary/workbench/main.ts`) and `src/assetLibrary/workbench/main.ts`, which mounts an empty `Workbench.vue` with PrimeVue set up as in `src/visualization/main.ts`. Do **not** add it to `build.rollupOptions.input` in `vite.config.ts`. Check that `pnpm dev` serves `/asset-workbench.html` and that `pnpm build` leaves no `asset-workbench` file in `dist/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catalog, builder kit, materials, asset cache, validator, workbench, the `FixtureBody` contract runtime, the Generic Fixture visualization with its fallback model, and the scene model changes. Library assets render (also as placeholders) in the editor and the show window and round-trip through save/load. The library UI starts in US1.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Catalog runtime

- [X] T004 [P] Create `src/assetLibrary/builders/kit.ts`, which implements `BuilderKit` (contracts/asset-catalog.ts):
  - `box(size, slot, { bevel })`: `BoxGeometry`, or a beveled box made from `ExtrudeGeometry` of a rounded rectangle when `bevel > 0`. Centered on x/z, bottom at y = 0.
  - `cylinder(rTop, rBottom, height, slot, segments = 16)`: bottom at y = 0.
  - `tube(from, to, radius, slot)`: a 12-segment cylinder oriented from `from` to `to`.
  - `lathe(profile, slot, segments = 24)`: `LatheGeometry` from `[radius, y]` pairs.
  - `group(name, ...children)`: a named group.
  - `mergeBySlot(root, keep = [])`: updates world matrices, then collects every mesh that is **not** inside a subtree whose root name is in `keep`. Geometries are baked to the root frame, grouped by `userData.slot` and merged with `mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils` (convert to non-indexed first if index presence differs). The result is one mesh per slot, named `slot:<slot>`, with `userData.slot` set. Kept subtrees are re-attached unchanged under the new root, keeping their transforms. Each kept subtree is also merged per slot internally, except for nested kept nodes.
  - Every mesh the kit creates has `userData.slot = slot` and a placeholder `MeshStandardMaterial` (the slot color is applied later by the asset cache).
- [X] T005 [P] Create `src/assetLibrary/materials.ts`:
  - `MATERIAL_PRESETS: Record<MaterialPresetId, MaterialPreset>` with exactly these values (research R14): `stage-floor-black` "Black stage floor" #141414 roughness 0.85 metalness 0; `wood` "Wood" #8a5a35 0.6 0; `metal-brushed` "Brushed metal" #b8bcc2 0.35 1; `fabric-black` "Black fabric" #0e0e0e 1 0 sheen 1; `fabric-white` "White fabric" #e8e8e8 1 0 sheen 1; `concrete` "Concrete" #8d8d8a 0.95 0; `plastic-glossy` "Glossy plastic" #d0d0d0 0.25 0 clearcoat 1.
  - `DEFAULT_SLOT_STYLE: Record<string, { color; roughness; metalness }>` for the standard slots `body` (#1c1c1c, 0.7, 0), `accent` (#3a3a3a, 0.5, 0), `metal` (#9a9ea4, 0.4, 1), `fabric` (#111111, 1, 0), `glass` (#202830, 0.1, 0), `screen` (#05070a, 0.3, 0); unknown slots use `body`.
  - `isMaterialPresetId(v): v is MaterialPresetId`.
  - `resolveSlotStyle(definition, slot, { material, color, variant })`, which applies, in this order: the default slot style, the definition's variant colors (`variants[].slots`), the material preset (replaces the **`body`** slot's color, roughness, metalness, sheen and clearcoat), and the `color` override (body slot color only).
- [X] T006 [P] Extend `LedLitMaterialParams` in `src/visualization/ledLitMaterial.ts` with `sheen?: number`, `sheenColor?: THREE.ColorRepresentation`, `sheenRoughness?: number`, `clearcoat?: number` and `clearcoatRoughness?: number`, all passed through to `MeshPhysicalMaterial` by `createLedLitMaterial` (fabric: `sheenColor` = base color, `sheenRoughness` 0.8; plastic: `clearcoatRoughness` 0.1)
- [X] T007 Create `src/assetLibrary/catalog.ts` with an `AssetCatalog` implementation built from the arrays exported by `catalog/fixtures.ts`, `catalog/stage.ts`, `catalog/decoration.ts` and `catalog/shapes.ts` (create these four files with empty exported arrays `FIXTURE_ASSETS`, `STAGE_ASSETS`, `DECORATION_ASSETS`, `SHAPE_ASSETS`):
  - `all()` in category order fixtures, stage, decoration, shapes;
  - `get(id)`;
  - `search(query)`: lower-case, split on whitespace, every word must be a substring of `name + " " + category + " " + keywords.join(" ")`; an empty query returns all;
  - `modelsFor(type)`: fixture definitions whose `fixture.visualizationTypes` include `type` and whose id is not in the runtime blocklist (`markInvalid(id)`, research R10, point 3);
  - `defaultModelFor(type)`: Moving Head → `fixture.moving-head-spot`, Spot → `fixture.par-can`, Generic Fixture → `fixture.generic`, Led Strip → `fixture.led-profile`, falling back to `fixture.generic` if the id is not (yet) registered.
  - Throw at module load in DEV if two definitions share an id. Export a singleton `assetCatalog`.
- [X] T008 Create `src/assetLibrary/assetCache.ts`, with one instance per `SceneView`:
  - `templateKey(assetId, params, variant, material, color)` → string (params sorted by key).
  - `acquire(key spec, userId): Promise<THREE.Object3D | null>`. For `procedural` it calls `build(kit)`; for `parametric`, `build(params, kit)` with the params completed and clamped by `completeParams` (T010); for `glb`, `fetch(source.file)` (relative to the app base, exactly like the old `modelLibrary.ts`) and parses it with `GLTFLoader.parseAsync`, caching the parsed scene per file. `shape` sources are not handled here.
  - Then it replaces the materials: every mesh gets an LED-lit material (`createLedLitMaterial(lighting, …)`) from `resolveSlotStyle` for its slot (for GLB meshes, slot = material name; if the GLB material has a texture map, use `convertToLedLit` and only recolor when a variant or color override applies). Materials are shared per slot within one template.
  - The template is cached and reference-counted by `userId`. `release(key, userId)` disposes geometry and materials when the last user goes away. Concurrent `acquire` calls share one promise. `getSync(key)` returns a ready template or `undefined`. `dispose()` frees everything.
  - Failed loads resolve to `null` and log `console.error`; the caller shows a placeholder.
- [X] T009 [P] Add `instantiate(template): THREE.Object3D` to `src/assetLibrary/assetCache.ts`. It returns `template.clone(true)`, which shares geometry and materials, with `userData.sharedResources = true` on the clone root (the flag that `objectBuilders.disposeObject3D` and `SceneView.clearModelContent` already respect)
- [X] T010 [P] Create `src/assetLibrary/params.ts`:
  - `completeParams(definition, raw): ParamValues` returns `{}` for non-parametric sources. For parametric sources it returns every `ParamSpec` key: numbers clamped to `[min, max]` and rounded to `step`; choices limited to the listed option values, otherwise the default; missing keys get `default`; unknown keys are dropped (data-model invariant 3).
  - `sizeOf(definition, params): Vec3` returns `source.size(completeParams(...))` for parametric sources, otherwise `defaultSize`. Each component is at least 0.01.
  - Export both from `index.ts`.

### Validator and workbench

- [X] T011 Create `src/assetLibrary/validate.ts` with `validateAsset(definition, template?) → ValidationIssue[]`, which implements every check in research R10:
  - **Metadata**: id matches `ASSET_ID_PATTERN` and starts with the category prefix (`fixture.`, `stage.`, `decoration.`, `shape.`); non-empty name; at least one keyword; `preview === "asset-library/previews/" + id + ".webp"`; credits complete; license in `ALLOWED_LICENSES`; `madeForProject` ⇒ `GPL-3.0-or-later`; `fixture` present if and only if `category === "fixtures"`.
  - **Geometry** (only with `template`): the bounding box (ignoring objects with `userData.excludeFromBounds`) matches `defaultSize` per axis within "±15 % … at least 2 cm tolerance"; the lowest point is at "y = 0 ± 1 cm"; the size is between 5 cm and 20 m; triangle count is within the budget (see Conventions).
  - **Fixture contract**: every `node` named in `movingParts`, `beam`, `emitters` and `mountingPoints` exists (`""` = root); tilt is a descendant of pan; `axis` is one of x/y/z and `min < max`; beam `direction` and emitter `normal`/`up` are unit vectors ±1 %; `lensRadius > 0`; emitter ids are unique and there is at least one emitter; at least one mounting point. Role requirements per visualization type: Moving Head needs pan, tilt and beam; Spot needs beam; Generic Fixture needs at least one emitter; Led Strip needs `ledStrip` and a parametric source with a `length` parameter.
  - **Parametric** (with a template factory `buildAt(params)` passed as an optional third argument): builds at min, default and max of every number parameter. Each build's bounding box must match `size(params)` within ±2 %.
  - Also export `validateCatalogMetadata(catalog)`, which runs the metadata checks for all definitions and reports duplicate ids.
- [X] T012 Call `validateCatalogMetadata(assetCatalog)` once at startup when `import.meta.env.DEV` is true, in `src/main.ts` (main window only) via a dynamic `import("@/assetLibrary")`, and log each issue with `console.error("[asset-library]", issue)`. Missing preview files cannot be checked synchronously here and are left to the workbench
- [X] T013 Implement `src/assetLibrary/workbench/Workbench.vue`, the dev-only page (research R10, point 1; quickstart "Asset gate"):
  - **Left**: a list of all catalog assets with a status dot (green, yellow for warnings, red for errors) and the summary line "<N> assets, <E> errors".
  - **Right**: a Three.js canvas using its own `WebGLRenderer`, `OrbitControls`, `HemisphereLight` plus a directional light, a 1 m grid, and an `AssetCache`. It shows the selected asset (for parametric assets, a "min / default / max" toggle) and the list of its issues. For each asset it runs `validateAsset` with the built template; parametric assets also get `buildAt`. Previews are checked with `fetch(preview, { method: "HEAD" })` (a missing file is an error).
  - **Contract overlay** for fixtures: small axis gizmos at the pan and tilt pivots, an arrow from the beam origin along the beam direction (length 0.5 m), emitter outlines, mounting points as cones along `direction`. For stage elements: mounting areas (lines/rects) and connection points (arrows). Toggle "Sweep" animates pan and tilt between their limits (5 s period) using `FixtureBody` (T015) once it exists.
  - **"Render previews"** renders every asset at 256 × 256 with a transparent background (`renderer.setClearColor(0x000000, 0)`). The camera looks at the bounding box center from direction (1, 0.8, 1.4), normalized, at a distance that fits the bounding sphere with fov 30. Each canvas is encoded as WebP (`canvas.toBlob(..., "image/webp", 0.9)`), all files are zipped with `fflate.zipSync` as `<id>.webp`, and the ZIP is downloaded as `asset-previews.zip`.

### Fixture contract runtime and Generic Fixture

- [X] T014 Add `VisualizationType.GENERIC = "Generic Fixture"` to `src/visualization/fixtureVisualization.ts`. Then add the matching entries so the code compiles: `RENDERER_TYPES` in `src/visualization/sceneView.ts` (pointing to `GenericRenderer` from T017) and `getVisualizationByType` in `src/visualization/fixtureVisualizations/factory.ts` (pointing to `GenericVisualization` from T018). Accept `"Generic Fixture"` in `sanitize.ts` (it already checks `Object.values(VisualizationType)`)
- [X] T015 Create `src/assetLibrary/fixtureBody.ts`, class `FixtureBody extends THREE.Group` (research R7):
  - Constructor `(definition: FixtureAssetDefinition, template: Object3D)`. It instantiates the template and finds `panNode` and `tiltNode` by `getObjectByName` (root for `""`), storing their rest quaternions.
  - `setPanTilt(panDeg, tiltDeg)` sets each node's quaternion to `rest × rotation(axis, deg)`.
  - It creates `beamAnchor: Object3D` as a child of the beam node at `beam.position`, oriented so its local **+Z** equals `beam.direction` (`quaternion.setFromUnitVectors((0,0,1), direction)`). If there is no `beam`, the anchor sits at the root and points +Y.
  - It creates the emitter meshes: per emitter a `CircleGeometry(radius, 32)` or `PlaneGeometry(w, h)`, oriented so its +Z is `normal` (rect: its +Y follows `up`). Material: `MeshBasicMaterial({ color: 0x000000, toneMapped: false, side: DoubleSide })`, `raycast` disabled. Each mesh is added to its node at `position` and kept in `emitters: Map<id, Mesh>`.
  - `setEmitterColor(id | "all", r, g, b)` (linear 0..1, values above 1 allowed for bloom).
  - `setModelScale(s)` scales the body group uniformly.
  - `dispose()` disposes only the emitter geometries and materials; template resources stay shared.
  - **Performance**: when one `FixtureBody` has more than 8 emitters, it also builds a merged emitter mesh with vertex colors. `setEmitterColor("all", …)` then updates only that mesh. The per-id meshes are created lazily and hidden until `setEmitterColor(id, …)` is called with a single id (feature 003).
- [X] T016 Extend `BaseRenderer` in `src/visualization/fixtureVisualizations/base.renderer.ts`:
  - Add `assets: AssetCache` to `RendererInputs`.
  - Add a virtual `onModelUpdate(modelId: string, modelScale: number): void`, which by default does nothing.
  - Add a protected helper `loadBody(modelId)`. It resolves the definition (unknown, invalid or wrong category → `assetCatalog.defaultModelFor(GENERIC)`, with a `console.warn`), acquires the template through `inputs.assets` with the renderer's uuid as user id, builds a `FixtureBody`, replaces the previous body (releasing it), and calls an abstract-ish `protected onBodyReady(body)` hook. Late results from an older model id are discarded.
  - Releasing the body template happens in `dispose()`.
  - In `src/visualization/sceneView.ts`: create `this.assets = new AssetCache(this.lighting)` in the constructor and pass it into every renderer's inputs. In `syncFixture`, keep a `modelKey = modelId + ":" + modelScale` in `FixtureEntry` and call `renderer.onModelUpdate(obj.modelId, obj.modelScale)` when it changes (also right after creating a renderer). `dispose()` calls `this.assets.dispose()` after `clear()`.
- [X] T017 Create `src/visualization/fixtureVisualizations/generic/generic.renderer.ts`, class `GenericRenderer extends BaseRenderer<GenericVisualizationConfig, number[]>`:
  - `onModelUpdate` → `loadBody` and `setModelScale`; `onBodyReady` adds the body.
  - `onFixtureValueUpdate(values)` computes `intensity` from `channelMapping.intensity` with the same mapping math as `MovingHeadRenderer.getChannelValue` (move that function into a shared `src/visualization/fixtureVisualizations/channelValue.ts` and use it from both). Unmapped intensity = `defaultValue` (1). Color = `(R, G, B)/255 + W/255` added to each component. If none of red, green, blue or white is mapped (all `-1`), the color is white (1, 1, 1) (FR-022: "white when no color is mapped, full when no intensity is mapped").
  - Calls `body.setEmitterColor("all", c.r * intensity * 4, c.g * intensity * 4, c.b * intensity * 4)` (factor 4 so full output blooms).
  - The latest values are stored and re-applied in `onBodyReady`.
- [X] T018 [P] Create `src/visualization/fixtureVisualizations/generic/generic.visualization.ts` (`GenericVisualization`: type `GENERIC`, `compatibleFixtures: [FixtureType.DMX]`, `defaultConfig` = `{ channelMapping: { intensity: { channel: -1, defaultValue: 1, min: 0, max: 1 }, red: -1, green: -1, blue: -1, white: -1 } }`, `onFixtureValueUpdate: (value) => ({ value })`) and `generic/types.ts` exporting `GenericVisualizationConfig` exactly as in `contracts/scene-state-delta.ts`. Then create `generic/GenericVisualizationSettings.vue`, modelled on `MovingHeadVisualizationSettings.vue` and reusing `ChannelMapping.vue` for intensity and `DmxChannelSelector.vue` for red/green/blue/white. Add `GenericVisualizationConfig` to the `FixtureVisualizationObject` union in `src/scene/model/types.ts` as `{ visualizationType: VisualizationType.GENERIC; config: GenericVisualizationConfig }`
- [X] T019 [P] Create the fallback model `src/assetLibrary/builders/fixtures/generic.ts` and its definition `fixture.generic` in `src/assetLibrary/catalog/fixtures.ts`:
  - Geometry: a dark rounded box 0.25 × 0.22 × 0.25 m on a short bracket (total height 0.3 m) with a round lens face on top.
  - Name "Generic fixture", keywords ["generic", "fixture", "light", "unknown", "fallback"], `defaultSize [0.25, 0.3, 0.25]`.
  - Fixture description: `visualizationTypes: [GENERIC, SPOT]`, `categories: ["Other", "Effect"]`, `beam: { node: "", position: [0, 0.3, 0], direction: [0, 1, 0] }`, `lensRadius: 0.08`, `emitters: [{ id: "lens", node: "", shape: "circle", radius: 0.08, position: [0, 0.301, 0], normal: [0, 1, 0] }]`, `mountingPoints: [{ id: "base", node: "", position: [0, 0, 0], direction: [0, -1, 0] }]`.
  - Asset gate.

### Scene model changes

- [X] T020 Update `src/scene/model/types.ts` following `contracts/scene-state-delta.ts`:
  - add `LibraryAssetObject` (`assetId: string; params: ParamValues; material: MaterialPresetId | null; color: string | null; variant: string | null; size: Vec3`), with `SceneObject` and `KNOWN_KINDS` extended by `"libraryAsset"` and an `isLibraryAsset` guard;
  - add `material: MaterialPresetId | null` to `ShapeObject`;
  - add `modelId: string; modelScale: number` to every `FixtureVisualizationObject` variant (intersect the union with `FixtureVisualizationModelFields`).
  - Import `MaterialPresetId` and `ParamValues` as type-only imports from `@/assetLibrary/types`. Update the header comment to name feature 002.
- [X] T021 Update `src/scene/model/defaults.ts`:
  - `createShapeObject` sets `material: null`.
  - `createFixtureVisualizationObject(fixtureId, type, config, name?, model?)` sets `modelId = model?.modelId ?? assetCatalog.defaultModelFor(type).id` and `modelScale = model?.modelScale ?? 1`.
  - New `createLibraryAssetObject(definition, partial?)`: name = `nextObjectName(scene, definition.name)` (passed in by the caller), `assetId = definition.id`, `params = completeParams(definition, {})`, `material = null`, `color = null`, `variant = null`, `size = sizeOf(definition, params)`.
  - Export `MODEL_SCALE_MIN = 0.25` and `MODEL_SCALE_MAX = 4`.
- [X] T022 Update `src/scene/model/sanitize.ts` with load rules 1, 3 and 4 of data-model.md ("Load rules"):
  - **`libraryAsset`**: `assetId` must be a string, otherwise the object becomes a `group` and the problem `Library asset "<name>" is invalid and was converted to a group` is recorded. For a **known** asset, `params = completeParams(def, raw.params)`, `material` = valid preset id **and** `def.supportsMaterial`, otherwise `null`, `color` = `#rrggbb` or `null`, `variant` = one of `def.variants[].id` or `null`. For an **unknown** asset, `params`, `material`, `color` and `variant` are kept if they have the right type (objects / strings / `null`), so newer files are not changed. `size` = `vec3(raw.size, def ? sizeOf(def, params) : [0.5, 0.5, 0.5])` with "Each component ≥ 0.01".
  - **`shape`**: `material` = a valid preset id or `null`.
  - **`fixtureVisualization`**: `modelScale` = `num(raw.modelScale, 1)` clamped to 0.25–4. `modelId` = a string if present. **If `modelId` is missing** (a 001 file), set `modelId = defaultModelFor(type).id` and record whether the object needs the spot fix (T042). If it is present but **known and incompatible** with the type, replace it with the default. If it is **unknown**, keep it.
  - Return counts `unknownAssets` and `unknownModels` alongside `problems` (extend the return type; update the caller in `src/stage/stage.ts`/the store load path so that each count produces one toast as worded in contracts/library-ui.md → Messages: "<n> objects use assets that are not available and are shown as placeholders." and "<n> fixture visualizations use unknown models; the generic fixture is shown.", using `emitSceneToast` with severity `warn`).
- [X] T023 Update `src/scene/sceneStore.ts` with these commands, all through `addObjects` / `updateObjects`, so they are undoable and synced:
  - `addLibraryAsset(assetId, placement?, transform?: Partial<LocalTransform>, parentId?: string | null): string | null` creates via `createLibraryAssetObject`, with the position from `placementPosition(placement)`, label `Add <asset name>`; selects it.
  - `setAssetParams(id, partialParams)` merges, runs `completeParams`, recomputes `size` (`sizeOf`), mergeKey `params:<id>`.
  - `setAssetMaterial(id, material)`: when `material !== null`, also sets `color` to the preset color in the same patch (research R14); label "Change material".
  - `setAssetColor(id, color | null)`.
  - `setAssetVariant(id, variant | null)`.
  - `replaceAsset(id, newAssetId)` keeps id, name, transform, parent and children; resets `params`/`material`/`color`/`variant` and recomputes `size`; label "Replace asset".
  - `setShapeMaterial(id, material)`, same rule as `setAssetMaterial`.
  - Extend `clampPatch` so `modelScale` stays within 0.25–4 and `size` components stay ≥ 0.01.
- [X] T024 Render `libraryAsset` objects in `src/visualization/objectBuilders.ts` and `src/visualization/sceneView.ts`:
  - `buildObject3D` returns a `THREE.Group` with a loading placeholder (grey wireframe box of the object's `size`) for `libraryAsset`. Change `createPlaceholder(label, color, size?: Vec3)` to accept a size (default `[0.5, 0.5, 0.5]`), with the box translated so its bottom is at y = 0.
  - In `SceneView`, add `syncLibraryAsset(entry)`, analogous to `syncModel`: compute `templateKey` from `assetId`, `params`, `variant`, `material` and `color`. When the key changes, release the old template, acquire the new one with the object id as user, and when it is ready, replace the content with `instantiate(template)`, using `clearModelContent`. If `assetCatalog.get(assetId)` is `undefined` or the load fails, show the **red** placeholder of the stored `size` with label `Unknown asset: <assetId>` (FR-070). A `shape` source is never stored as `libraryAsset`.
  - Call `syncLibraryAsset` from `applyObjects`, and release in `disposeEntry`. Make sure `updateObject3D` returns `true` for `libraryAsset` (no rebuild on transform changes).
- [X] T025 Render `shape.material` in `src/visualization/objectBuilders.ts`. When `material` is set, `createShapeMaterial` uses the preset's roughness, metalness, sheen and clearcoat together with `obj.color`; `updateObject3D` updates these properties in place (key `material`). When `material` is `null`, keep the 001 defaults (roughness 0.8, metalness 0)

**Checkpoint**: `pnpm lint` and `pnpm build` pass. A hand-edited project with a `libraryAsset` object referencing `decoration.does-not-exist` and a Generic Fixture visualization (created by editing the type of an existing visualization in the JSON) loads; the unknown one shows a red placeholder of its stored size in editor and show window; save/load keeps both unchanged. The workbench shows `fixture.generic` green.

---

## Phase 3: User Story 1 - Browse the library and place assets (Priority: P1) 🎯 MVP

**Goal**: Asset library panel with categories, previews and search; dragging an asset into the 3D view places it upright on the surface under the pointer at a realistic size; scenes store only asset ids.

**Independent Test**: Open the library, find assets by browsing and by searching, drag five different assets into the scene (basic shapes, table, chair, speaker stack, generic fixture) and confirm they stand on surfaces at realistic sizes; save and reopen the project (quickstart scenarios 1–3, 14).

### Assets needed for the MVP

- [X] T026 [P] [US1] Create `src/assetLibrary/catalog/shapes.ts` with `shape.box`, `shape.cylinder`, `shape.plane` and `shape.sphere` (names "Box", "Cylinder", "Plane", "Sphere"; source `{ type: "shape", shape }`; `defaultSize` from the 001 shape defaults: box [1, 1, 1], cylinder [1, 1, 1], plane [2, 0.01, 2], sphere [1, 1, 1]; keywords e.g. ["box", "cube", "block", "basic"]; `supportsMaterial: true`) (FR-006)
- [X] T027 [P] [US1] Create `src/assetLibrary/builders/decoration/table.ts` and the definition `decoration.table` in `src/assetLibrary/catalog/decoration.ts`: a table top of 1.2 × 0.04 × 0.8 m at a height of 0.75 m on four square legs of 0.05 m; slots `body` (top) and `accent` (legs); `defaultSize [1.2, 0.75, 0.8]`; variants `wood` (body #8a5a35, accent #6b4429) and `black` (body #151515, accent #222222); keywords ["table", "desk", "furniture"]. Asset gate
- [X] T028 [P] [US1] Create `src/assetLibrary/builders/decoration/chair.ts` and `decoration.chair`: seat 0.45 × 0.45 m at 0.45 m, backrest up to 0.85 m, four legs; `defaultSize [0.45, 0.85, 0.5]`; variants `wood` and `black`; keywords ["chair", "seat", "furniture"]. Asset gate
- [X] T029 [P] [US1] Create `src/assetLibrary/builders/decoration/speakerStack.ts` and `decoration.speaker-stack`: a sub cabinet of 0.6 × 0.6 × 0.6 m with two 18" cones on the front (+Z), plus a top cabinet of 0.6 × 1.2 × 0.5 m with two 12" cones and a horn, stacked (total height 1.8 m); slots `body`, `accent` (grille cones), `metal` (corners); `defaultSize [0.6, 1.8, 0.6]`; variants `black` and `white`; keywords ["speaker", "pa", "loudspeaker", "box", "sound", "stack"]. Asset gate

### Library panel

- [X] T030 [P] [US1] Create `src/scene/editor/library/AssetTile.vue`. Props: `asset: AssetDefinition`. It shows the preview `<img :src="asset.preview" loading="lazy" draggable="false">`, falling back to a category icon (PrimeIcons `pi-lightbulb` fixtures, `pi-box` stage, `pi-star` decoration, `pi-stop` shapes) on the image `error` event, plus the name. Tooltip `"<name> · <H> m high"` with H = `defaultSize[1]` to 2 decimals. The tile is `draggable="true"`; `dragstart` sets `dataTransfer.setData("application/x-lms-asset", asset.id)` and `effectAllowed = "copy"`. It emits `activate` on double-click and on Enter (tabindex 0)
- [X] T031 [US1] Create `src/scene/editor/library/AssetLibraryPanel.vue` (contracts/library-ui.md → Asset library panel):
  - A header with the title "Asset library" and a ⋮ `Menu` with the item "Asset credits" (emits `showCredits`; wired up in US8).
  - An `InputText` search with a clear icon; Esc clears it.
  - Sections in the order Fixtures, Stage, Decoration, Basic shapes, each a collapsible header plus a CSS grid of `AssetTile`s (min tile width 84 px). The open/closed state lives in a module-level `reactive` object so it survives remounts within the session.
  - With a non-empty query: show only `assetCatalog.search(query)` results, auto-expand sections with hits, and hide empty sections. With no hits, show `No assets match "<query>"`.
  - `activate` on a tile calls `emit("add", assetId)`.
- [X] T032 [US1] Split the left column of `src/scene/editor/SceneEditor.vue` with a nested horizontal `splitpanes` (`horizontal` prop): `Outliner` on top (size 50, min-size 15) and `AssetLibraryPanel` below (size 50, min-size 15). Handle `@add="addAssetAtCenter"`, which raycasts from the viewport center (new overlay method `surfaceHitAt(ndc: {x: 0, y: 0})`) and calls `addAssetById(assetId, hit)` (T034)

### Placement by drag & drop

- [X] T033 [US1] Create `src/scene/editor/assetDrop.ts`, class `AssetDropController`, constructed by `EditorOverlay` with the `SceneView`, the store and the canvas:
  - `dragOver(event: DragEvent)`: only reacts to `event.dataTransfer.types.includes("application/x-lms-asset")` (the id is not readable during dragover, so remember the id from a module-level `currentDragAssetId` that `AssetTile` sets in `dragstart` and clears in `dragend`). Calls `preventDefault()` and sets `dropEffect = "copy"`. Raycasts like `updateSurfaceHit`, ignoring the ghost; with no hit, it intersects the ray with the plane y = 0, and with no intersection it uses the origin.
  - Shows a **ghost**: the asset template from `view.assets` instantiated with all materials cloned to `transparent: true, opacity: 0.5, depthWrite: false`, put on `EDITOR_LAYER`, with its base point at the hit point and rotation 0. Shapes use a temporary shape mesh. Fixture models use their body template.
  - `dragLeave()` and Esc remove the ghost.
  - `drop(event)` removes the ghost and calls `addAssetById(assetId, placement)`.
  - Snapping hooks: a `resolveSnap?: (assetId, point, ray) => SnapResult | null` field that US5 fills in; when it is set and returns a result, the ghost uses the result's transform.
  - Ghost materials are disposed on removal; the template is released.
- [X] T034 [US1] Add `addAssetById(assetId, placement, snap?)` to `src/scene/editor/SceneEditor.vue`, or as a helper in `src/scene/editor/assetDrop.ts` that only uses store commands:
  - `shapes` → `store.addShape(def.source.shape, placement)`;
  - `fixtures` → `store.addFixtureModel(def.id, placement)` (T048 in US2; until then, fixtures are hidden in the panel by a `showFixtures` flag that US2 turns on);
  - other categories → `store.addLibraryAsset(def.id, placement)`.
  - Each command selects the new object (FR-003). Hook the controller into `src/scene/editor/Viewport.vue` (`@dragover`, `@dragleave`, `@drop` on the canvas container, forwarded to the overlay's `AssetDropController`).
- [X] T035 [US1] Create `src/scene/editor/inspector/LibraryAssetProperties.vue` (first version) and add a `libraryAsset` branch to `src/scene/editor/Inspector.vue`. It shows the asset preview and name, the size ("W × H × D m" from `size`), and the button **Replace asset…**, which opens `AssetPicker.vue` (T036). For an unknown `assetId` it shows the notice "This asset is not available in this version (<id>)." above the button. Parameter, material, color and variant fields are added in US4, US7 and US6
- [X] T036 [P] [US1] Create `src/scene/editor/library/AssetPicker.vue`: a `Dialog` with the same search and tile grid as the panel (extract the grid into a shared `AssetGrid.vue` used by both). Prop `category?: AssetCategory` filters it (when the asset is unknown, all categories except fixtures and shapes are shown). Selecting a tile emits `pick(assetId)`, and `LibraryAssetProperties` then calls `store.replaceAsset(id, assetId)`
- [X] T037 [US1] Run the workbench "Render previews" for the assets that exist so far (`shape.*`, `decoration.table`, `decoration.chair`, `decoration.speaker-stack`, `fixture.generic`) and add the WebP files to `public/asset-library/previews/`

**Checkpoint**: Quickstart scenarios 1–3 and 14 (with the assets that exist so far) pass in browser and Electron. The project JSON contains only `assetId`/`params` for library assets. The show window shows placed assets.

---

## Phase 4: User Story 2 - Generic fixture models that work with the visualizations (Priority: P1)

**Goal**: Moving head, spot and LED strip visualizations render bodies from library models through the contract; the user picks and switches models; type and model are preselected from the OFL category, and the model is auto-scaled from the fixture dimensions. The old moving head GLB is removed.

**Independent Test**: Assign the three moving head models (spot, beam, wash) in turn to the same moving head fixture, play a pan/tilt sequence, and confirm each model moves correctly with the beam starting at its lens; create a fixture from the OFL library and see type and model preselected (quickstart scenarios 4, 5, 7, 16).

### Fixture models for the existing visualizations

- [X] T038 [P] [US2] Create `src/assetLibrary/builders/fixtures/movingHeadSpot.ts` and the definition `fixture.moving-head-spot` ("Moving head (spot/beam)"):
  - Geometry: a base box of 0.35 × 0.14 × 0.3 m with a display on the front; a node **`pan`** at (0, 0.14, 0) holding a U-shaped yoke (two arms of 0.04 × 0.3 × 0.12 m at x = ±0.15); a node **`tilt`** at (0, 0.38, 0) (pivot between the arm tops) holding a head (lathe profile, length 0.36 m along +Y from y = −0.12 to 0.24 relative to the tilt node, max radius 0.11 m, front lens ring at the +Y end).
  - Slots `body`, `accent`, `glass`. `kit.mergeBySlot(root, ["pan", "tilt"])`. `defaultSize [0.35, 0.6, 0.3]`.
  - Description: `visualizationTypes: [MOVING_HEAD]`, `categories: ["Moving Head"]`, `movingParts: { pan: { node: "pan", axis: "y", min: -270, max: 270 }, tilt: { node: "tilt", axis: "x", min: -135, max: 135 } }`, `beam: { node: "tilt", position: [0, 0.24, 0], direction: [0, 1, 0] }`, `lensRadius: 0.06`, `emitters: [{ id: "lens", node: "tilt", shape: "circle", radius: 0.06, position: [0, 0.241, 0], normal: [0, 1, 0] }]`, `mountingPoints: [{ id: "base", node: "", position: [0, 0, 0], direction: [0, -1, 0] }]`.
  - Keywords ["moving head", "spot", "beam", "mover", "intelligent"]. Adjust the numbers so `defaultSize` and the validator agree. Asset gate.
- [X] T039 [P] [US2] Create `src/assetLibrary/builders/fixtures/movingHeadBeam.ts` and `fixture.moving-head-beam` ("Moving head (beam)"): the same node structure as T038 (`pan` axis y −270..270, `tilt` axis x −135..135), but slimmer: base 0.3 × 0.12 × 0.25 m, a narrow cylindrical head (radius 0.075 m) with a small lens (`lensRadius 0.035`); `defaultSize [0.3, 0.5, 0.25]`; keywords ["moving head", "beam", "sharpy", "mover"]. Asset gate
- [X] T040 [P] [US2] Create `src/assetLibrary/builders/fixtures/movingHeadWash.ts` and `fixture.moving-head-wash` ("Moving head (wash)"): the same node structure; a wider, shorter head (radius 0.15 m) with a flat front plate carrying 7 LED lenses in a hexagonal pattern. Emitters: `lens` (circle, radius 0.13 m, the whole front, used by the beam visual) **plus** `cell-1`..`cell-7` (circles of radius 0.03 m at the 7 hex positions, 2 mm in front of the plate); `beam.position` at the plate center; `lensRadius 0.13`; `defaultSize [0.4, 0.55, 0.35]`; keywords ["moving head", "wash", "led", "mover"]. Asset gate
- [X] T041 [P] [US2] Create `src/assetLibrary/builders/fixtures/parCan.ts` and `fixture.par-can` ("Par can"):
  - Geometry: a U-bracket (node-less, static) holding a can (lathe, radius 0.11 m, length 0.28 m) pointing **up**, lens at the top; standing on the bracket feet. Slots `body`, `metal`, `glass`.
  - Description: `visualizationTypes: [SPOT, GENERIC]`, `categories: ["Color Changer", "Dimmer"]`, `beam: { node: "", position: [0, 0.35, 0], direction: [0, 1, 0] }`, `lensRadius: 0.09`, emitter `lens` (circle, radius 0.09 m, at y = 0.351 m), `mountingPoints` `base` at the origin, direction [0, −1, 0].
  - `defaultSize [0.25, 0.35, 0.25]`; keywords ["par", "par can", "spot", "light", "can"]. Asset gate.
- [X] T042 [US2] Implement the spot re-orientation from research R3 in `src/scene/model/transformMath.ts` and `src/scene/model/sanitize.ts`. Add `composeLocalRotation(rotationDeg: Vec3, axis: Axis, angleDeg: number): Vec3`, which returns the Euler XYZ (degrees, normalized to (−180, 180]) of `q(rotation) × q(axis, angle)`. In `sanitize.ts`, for a `fixtureVisualization` with `visualizationType === "Spot"` and **no** `modelId` in the raw data, set `rotation = composeLocalRotation(rotation, "x", 180)` so the beam, which now leaves the model along local +Y, points where the old −Y beam pointed. Record no problem message (silent conversion)
- [X] T043 [US2] Rewrite `src/visualization/fixtureVisualizations/movingHead/movingHead.renderer.ts` on top of the contract:
  - Remove the `modelLibrary` import, the `base_001`/`yoke_001`/`head_001` lookups and every `0.73` offset.
  - `onModelUpdate` → `loadBody(modelId)` and `body.setModelScale(scale)`.
  - `onBodyReady(body)`: attach `beam`, `cap` (circle of radius = description `lensRadius`, at the anchor origin, facing +Z), `spotlight` and `target` to `body.beamAnchor`. The beam cylinder and the target are oriented along the anchor's **+Z** (rotate the beam geometry by +90° about X so its axis is +Z, and translate it by `len / 2` along +Z). Set `topRadius` to `lensRadius`. Re-apply the last values.
  - `onFixtureValueUpdate`: `body.setPanTilt(pan, tilt)` instead of setting `yoke.rotation.y` / `head.rotation.x`. The color also goes to `body.setEmitterColor("all", …)`. Until the body is ready, values are only stored.
  - `updateWorld` is unchanged (it uses the world positions of `spotlight` and `target`).
  - `dispose` releases the body.
- [X] T044 [US2] Rewrite `src/visualization/fixtureVisualizations/spot/spot.renderer.ts`:
  - Remove `createEditorProxy` and the proxy fields, because the body can be picked (FR-021).
  - `onModelUpdate` → `loadBody`.
  - `onBodyReady`: attach the volume cone, the `spotlight` and its target to `body.beamAnchor`, oriented along the anchor's +Z (rotate the cone geometry so it starts at the origin and widens along +Z; target at (0, 0, 1)). The cone's top radius = `lensRadius`.
  - The color also drives `body.setEmitterColor("all", …)`.
  - Rename the doc comment "emits local −Y" to "emits along the model's beam direction".
- [X] T045 [US2] Create the LED strip body `src/assetLibrary/builders/fixtures/ledProfile.ts` and the definition `fixture.led-profile` ("LED strip profile"):
  - A parametric source with `params: [{ key: "length", label: "Length", type: "number", min: 0.05, max: 50, step: 0.01, unit: "m", default: 1 }]` and `size: (p) => [p.length, 0.02, 0.02]`. `build` creates an aluminium U-channel (slot `metal`) of 0.02 × 0.012 m and a diffuser strip (slot `glass`, emissive-free) along **+X**, centered on the origin, bottom at y = 0.
  - Description: `visualizationTypes: [LED_STRIP]`, `categories: ["Pixel Bar"]`, `lensRadius: 0.008`, one `emitters` entry `strip` (rect `[length, 0.012]`, at the default length 1), `mountingPoints` `back` at the origin with direction [0, −1, 0], and `ledStrip: { profileWidth: 0.02, profileHeight: 0.02 }`.
  - Asset gate (validator role check for Led Strip).
- [X] T046 [US2] Update `src/visualization/fixtureVisualizations/ledStrip/ledStrip.renderer.ts`:
  - In `onModelUpdate` and `onConfigUpdate`, rebuild the body as `instantiate(acquire({ assetId: modelId, params: { length: |end − start| } }))`, positioned at the midpoint of `start`/`end` and rotated so its +X follows `end − start` and its −Y (the bottom) faces the strip's emission direction (local +Y of the object, per 001: "direction = local +Y"; the diffuser therefore faces local +Y).
  - Release the previous template (acquire keyed by the rounded length, to 1 cm, to limit rebuilds).
  - Remove the box part of the editor proxy, keep the direction arrow. The body is pickable (no `raycast` override).
- [X] T047 [US2] Delete `public/3d-models/moving_head_lowpoly.glb` (and the then-empty `public/3d-models/`) and `src/visualization/modelLibrary.ts`. Remove every `modelLibrary.initialize()` call (search `modelLibrary` in `src/`, e.g. `src/visualization/main.ts`, `src/visualization/sceneView.ts`, `src/scene/editor/Viewport.vue`) and anything awaiting it before creating renderers. Search the repository for `3d-models` and fix the remaining references

### Model selection, preselection and scaling

- [X] T048 [US2] Add to `src/scene/sceneStore.ts`:
  - `setFixtureModel(objectId, modelId)` keeps everything except `modelId` and, when the linked fixture has plausible dimensions, `modelScale` = `preselectForFixture(...).modelScale` recomputed for the new model; label "Change model"; data-model invariant 4.
  - `resetModelScale(objectId)` sets `modelScale = 1`, label "Reset model size".
  - `addFixtureModel(modelId, placement)` creates an **unlinked** fixture visualization (`fixtureId: null`) with `visualizationType = def.fixture.visualizationTypes[0]`, the default config of that type, `modelId`, `modelScale: 1` and name `nextObjectName(scene, def.name)`; it selects it (contracts/library-ui.md → Placement, item 4).
  - Change `setVisualizationType` to also set `modelId` to the mapped model for the linked fixture (`preselectForFixture`) if that model supports the new type, otherwise `defaultModelFor(type)` (invariant 2).
  - Change `addFixtureVisualization(fixtureId, type, placement?, model?)` to accept an optional `{ modelId, modelScale }` and, when it is missing, to use `preselectForFixture` if its type equals `type`, otherwise `defaultModelFor(type)` with scale 1.
  - Turn on `showFixtures` in the library panel (T034).
- [X] T049 [P] [US2] Create `src/assetLibrary/categoryMapping.ts` with `preselectForFixture(definition, mode): FixturePreselection`, implementing the table in research R13 exactly:
  - Walk `definition.categories` in order and use the first mapped category. Name tests are case-insensitive on `definition.name`; `lens = (mode?.physical ?? definition.physical)?.lens`; matrix pixel count = product of `definition.matrix?.pixelCount ?? [1]`.
  - Moving Head → MOVING_HEAD + `fixture.moving-head-wash` if the name contains "wash" or `lens.degreesMinMax[1] ≥ 25`, else `fixture.moving-head-spot`.
  - Scanner / Barrel Scanner → MOVING_HEAD + `fixture.scanner`.
  - Color Changer / Dimmer → SPOT + `fixture.led-bar` if the pixel count is > 1, else `fixture.profile-spot` if the name contains "profile", "ellipsoidal" or "leko", else `fixture.wash-fresnel` if it contains "wash" or "fresnel", else `fixture.par-can`.
  - Pixel Bar → GENERIC + `fixture.pixel-bar`. Matrix → GENERIC + `fixture.led-panel`. Strobe → GENERIC + `fixture.strobe`. Blinder → GENERIC + `fixture.blinder`. Laser → GENERIC + `fixture.laser`. Smoke / Hazer → GENERIC + `fixture.fog-machine`.
  - Effect / Flower / Fan / Stand / Other → GENERIC + `fixture.flame-projector` if the name contains "flame" or "fire", `fixture.co2-jet` for "co2" or "cryo", `fixture.cold-spark` for "spark" or "sparkular", else `fixture.generic`. No category or no definition → GENERIC + `fixture.generic`.
  - A mapped model id that is not registered (yet) falls back to `assetCatalog.defaultModelFor(type)`.
  - **Scale**: `dims = (mode?.physical ?? definition.physical)?.dimensions` (mm, `[width, height, depth]`); "used only if all three are between 30 mm and 3000 mm"; `modelScale = clamp(median(dims[i] / 1000 / def.defaultSize[i]), 0.25, 4)`, otherwise `1`.
  - Also export `defaultChannelRanges(def)`, which returns pan/tilt `min`/`max` from `movingParts` for new Moving Head configs.
- [X] T050 [US2] Use the preselection in the creation flows:
  - `src/scene/editor/AddFixtureVisualizationDialog.vue`: when the fixture changes, set `type` and a new `modelId` ref from `preselectForFixture(fixture.config.definition, fixture.config.mode)` for DMX fixtures, or the type's default model for other fixture types. Add a **Model** `Select` under the type select that lists `assetCatalog.modelsFor(type)` with a 32 px preview image and the name, and resets to the mapped/default model when the type changes. Emit `confirm(fixtureId, type, modelId)` and pass the model through `SceneEditor.vue` to `store.addFixtureVisualization(..., { modelId, modelScale })` (the scale from the preselection only if the chosen model is the preselected one, otherwise it is recomputed with the same dimension rule for the chosen model).
  - `src/stage/components/FixtureSettings.vue`: creating a visualization passes the preselection.
  - Moving Head default configs use `defaultChannelRanges` for the pan/tilt `min`/`max` (in `store.addFixtureVisualization`).
- [X] T051 [US2] Update `src/scene/editor/inspector/FixtureVisualizationProperties.vue` (contracts/library-ui.md → Fixture visualization):
  - A **Model** `Select` with preview and name from `assetCatalog.modelsFor(object.visualizationType)` → `store.setFixtureModel`. If `object.modelId` is unknown, show the notice "Model <id> is not available; showing the generic fixture." and include the id as a disabled option.
  - **Model size** shows `Math.round(modelScale * 100) + " %"` with a **Reset to model size** button (disabled at 100 %) and the hint "Scaled to fixture dimensions" when `modelScale !== 1` and the linked fixture has plausible dimensions.

**Checkpoint**: Quickstart scenarios 4, 5, 7 and 16 pass in both targets. The workbench sweep shows all three moving heads correctly. `git ls-files public/3d-models` is empty.

---

## Phase 5: User Story 3 - Models for every common fixture category (Priority: P1)

**Goal**: At least one model for every FR-020 category; fixtures without a dedicated effect glow at their emitters following intensity and color; multi-cell models describe each cell.

**Independent Test**: Create one fixture of each FR-020 category, place them, map intensity/color, and confirm each shows its model and a glowing emitter that follows the channel values (quickstart scenario 6).

All tasks in this phase add one builder file in `src/assetLibrary/builders/fixtures/` and one definition in `src/assetLibrary/catalog/fixtures.ts`, using the sizes, types and emitters from data-model.md → Library inventory. Every model gets `mountingPoints` (base center with direction [0, −1, 0], or the bracket for bar-shaped fixtures) and ends with the asset gate. Because the definitions share `catalog/fixtures.ts`, add the definitions one after another; the builder files can be written in parallel.

- [X] T052 [P] [US3] `fixture.wash-fresnel` "Wash (Fresnel)" in `builders/fixtures/washFresnel.ts`: a can with a stepped Fresnel lens face and barn-door flaps (static); types [SPOT, GENERIC]; categories ["Dimmer", "Color Changer"]; size 0.3 × 0.4 × 0.3; emitter `lens` (circle r 0.1); `lensRadius 0.1`; beam +Y at the lens; keywords ["wash", "fresnel", "pc", "soft light"]
- [X] T053 [P] [US3] `fixture.profile-spot` "Profile spot (ellipsoidal)" in `builders/fixtures/profileSpot.ts`: a long barrel with a lens tube, a lamp housing and a yoke; it stands with the barrel tilted to point **up** (barrel axis along +Y at rest so the beam is +Y; the 0.7 m length lies along Y). Correct the inventory size to the built model (expected about 0.25 × 0.7 × 0.4) and update `data-model.md` accordingly. Types [SPOT, GENERIC]; categories ["Dimmer"]; emitter `lens` r 0.06; keywords ["profile", "ellipsoidal", "leko", "source four", "spot"]
- [X] T054 [P] [US3] `fixture.scanner` "Scanner" in `builders/fixtures/scanner.ts`: a box body standing upright (0.25 × 0.5 × 0.25 m; correct the inventory size to the built model) with a mirror at the top. Node `pan` at the mirror center (axis y, −90..90) and child node `tilt` (axis x, −45..45) holding the mirror plate. Beam on `tilt`, pointing +Y at rest. Types [MOVING_HEAD]; categories ["Scanner", "Barrel Scanner"]; emitter `aperture` (circle r 0.03) at the mirror; keywords ["scanner", "mirror", "barrel"]
- [X] T055 [P] [US3] `fixture.strobe` "Strobe" in `builders/fixtures/strobe.ts`: a flat housing of 0.5 × 0.2 × 0.15 m on a U-bracket, standing with the front face pointing **up** (+Y); emitter `tube` (rect 0.42 × 0.08 m) on the front; types [GENERIC]; categories ["Strobe"]; keywords ["strobe", "flash", "atomic"]. Correct the size to the built orientation
- [X] T056 [P] [US3] `fixture.blinder` "Blinder (4 cells)" in `builders/fixtures/blinder.ts`: a 0.5 × 0.5 × 0.2 m box on a bracket, front facing **up**, with 2 × 2 reflector cups. Emitters `cell-1`..`cell-4` (circle r 0.09; numbering row by row, starting top-left as seen from the front); types [GENERIC]; categories ["Blinder"]; keywords ["blinder", "audience", "molefay", "dwe"]. Correct the size to the built orientation
- [X] T057 [P] [US3] `fixture.led-bar` "LED bar / batten" in `builders/fixtures/ledBar.ts`: a 1.0 × 0.1 × 0.1 m bar lying along X on two small feet, front facing **up**. Emitters `cell-1`..`cell-8` (rect 0.1 × 0.06, left to right along +X); types [GENERIC, SPOT] (the spot beam uses `beam` at the bar center, direction +Y); categories ["Color Changer", "Pixel Bar"]; `lensRadius 0.04`; keywords ["led bar", "batten", "wash bar", "bar"]
- [X] T058 [P] [US3] `fixture.pixel-bar` "Pixel bar" in `builders/fixtures/pixelBar.ts`: a 1.0 × 0.06 × 0.06 m slim bar lying along X, front up. Emitters `cell-1`..`cell-16` (rect 0.055 × 0.04); types [GENERIC]; categories ["Pixel Bar"]; keywords ["pixel bar", "pixel", "led tube", "bar"]
- [X] T059 [P] [US3] `fixture.led-panel` "LED panel" in `builders/fixtures/ledPanel.ts`: a 0.5 × 0.5 × 0.08 m panel standing upright on a foot, front facing **+Z**. Because the panel faces the audience, `beam` is omitted and only GENERIC is declared. Emitters `cell-<row>-<col>` for an 8 × 8 grid (rect 0.055 × 0.055, row 1 at the top), 1 mm in front of the panel, normal [0, 0, 1]; types [GENERIC]; categories ["Matrix"]; keywords ["led panel", "matrix", "video wall", "tile", "screen"]. Check that the merged emitter path of T015 (> 8 emitters) is used
- [X] T060 [P] [US3] `fixture.laser` "Laser" in `builders/fixtures/laser.ts`: a box of 0.25 × 0.15 × 0.3 m with an aperture window on the front, standing on its base with the aperture pointing **+Z** (lasers are usually placed level). Emitter `aperture` (rect 0.06 × 0.03, normal +Z); `beam: { node: "", position: front center, direction: [0, 0, 1] }`; types [GENERIC]; categories ["Laser"]; keywords ["laser", "beam", "show laser"]. Add a note in the definition comment that its rest beam is +Z by design (an exception to research R3, allowed because GENERIC does not use the beam); the validator's +Y rule applies only to MOVING_HEAD and SPOT models
- [X] T061 [P] [US3] `fixture.flame-projector` "Flame projector" in `builders/fixtures/flameProjector.ts`: a square base box with a nozzle pipe pointing up and a pilot shield; emitter `nozzle` (circle r 0.03, normal +Y) at the nozzle tip; types [GENERIC]; categories ["Effect"]; keywords ["flame", "fire", "flame projector", "pyro"]
- [X] T062 [P] [US3] `fixture.co2-jet` "CO2 jet" in `builders/fixtures/co2Jet.ts`: a cylindrical body with a nozzle on top and a hose connector; emitter `nozzle` (circle r 0.02, normal +Y); types [GENERIC]; categories ["Effect", "Smoke"]; keywords ["co2", "cryo", "jet", "cannon"]
- [X] T063 [P] [US3] `fixture.cold-spark` "Cold spark machine" in `builders/fixtures/coldSpark.ts`: a low square box (0.35 × 0.25 × 0.35 m) with a round outlet on top; emitter `nozzle` (circle r 0.04, normal +Y); types [GENERIC]; categories ["Effect"]; keywords ["cold spark", "sparkular", "spark", "fountain"]
- [X] T064 [P] [US3] `fixture.fog-machine` "Fog machine / hazer" in `builders/fixtures/fogMachine.ts`: a box of 0.5 × 0.25 × 0.25 m with a nozzle on the front (+Z) and a handle; emitter `nozzle` (circle r 0.02, normal +Z); types [GENERIC]; categories ["Smoke", "Hazer"]; keywords ["fog", "smoke", "hazer", "haze", "fogger"]
- [X] T065 [US3] Update the validator in `src/assetLibrary/validate.ts`: the rule "beam direction at rest points to model +Y" is checked (world direction of the beam at pan = tilt = 0 within 1°) **only** for models that declare MOVING_HEAD or SPOT. Then run the workbench over all 19 fixture models and fix every reported error
- [X] T066 [US3] Check `preselectForFixture` against the real OFL definitions in `src/stage/fixtures/dmx/ofl_export_ofl.zip` through the workbench: add a dev-only "Category mapping" tab to `src/assetLibrary/workbench/Workbench.vue` that loads the OFL library the same way `src/stage/fixtures/dmx/fixtureLibrary.ts` does, maps every fixture, and shows counts per (type, model) plus a list of fixtures that fell back to `fixture.generic`. Review the list and adjust the name keywords in `categoryMapping.ts` only where an obvious category is misassigned
- [X] T067 [US3] Render previews for all fixture models (workbench "Render previews") and add them to `public/asset-library/previews/`

**Checkpoint**: Quickstart scenario 6 passes in both targets. The workbench shows 0 errors for all fixture models.

---

## Phase 6: User Story 4 - Parametric stage construction (Priority: P2)

**Goal**: Platform, stairs, truss (straight, corner, tower), backdrop, wall and floor as parametric elements that rebuild without distortion, with inspector fields and enforced ranges.

**Independent Test**: Build a 6 × 4 × 1 m stage with stairs, a 6 m truss line with two towers and a backdrop, then change the stage height and truss length and confirm the elements adapt without distortion (quickstart scenario 8).

All builders go into `src/assetLibrary/builders/stage/`, all definitions into `src/assetLibrary/catalog/stage.ts`, with `category: "stage"`, `supportsMaterial: true`, `materialSlots` including `body`, the ranges and defaults exactly as in data-model.md → "Parametric element parameters", and `defaultSize = size(defaults)`. Module counts use `n = max(1, round(L / module))` with module length `L / n` (research R5). Each ends with the asset gate, including the min/default/max builds.

- [X] T068 [P] [US4] Create `builders/stage/trussCommon.ts` with `buildTrussSection(kit, length, profile)`: profiles `flat` (2 chords), `triangle` (3 chords, apex up) and `square` (4 chords), all **0.29 m** wide; chord tubes ⌀ 50 mm (slot `metal`); braces ⌀ 20 mm, zig-zag diagonals per bay with bay = `length / max(1, round(length / 0.5))`; end plates (thin boxes 0.29 × 0.29 × 0.01 m) at both ends. Built along **+X** from `-length/2` to `+length/2`, with the bottom chords at y = 0 (base point). Export `trussChordLines(length, profile)`, which returns the chord lines (start, end, radius 0.025) for the mounting areas of US5. Merge everything into one mesh per slot
- [X] T069 [US4] `stage.truss-straight` "Truss (straight)" (depends on T068): params `length` 0.25–30 m (default 2, step 0.01) and `profile` flat/triangle/square (default square); `size = [length, profile === "flat" ? 0.05 : 0.29, 0.29]` (the flat truss lies flat: its 2 chords are side by side, 0.29 m apart along Z, at y = 0.025; the triangle's apex is 0.29 m high); keywords ["truss", "rigging", "beam", "straight"]
- [X] T070 [US4] `stage.truss-corner` "Truss corner" (depends on T068): param `profile` only; two 0.5 m legs at 90° (along +X and +Z from the corner block), plus a corner cube; `size` from the profile; keywords ["truss", "corner", "rigging", "90"]
- [X] T071 [US4] `stage.truss-tower` "Truss tower" (depends on T068): param `height` 1–8 m (default 3); a vertical square truss section (built with `buildTrussSection` and rotated so its length runs along +Y, starting on top of the base plate); base plate 0.8 × 0.02 × 0.8 m (slot `metal`); top block 0.35 m cube; `size = [0.8, height, 0.8]`; keywords ["truss", "tower", "goalpost", "upright", "stand"]
- [X] T072 [P] [US4] `stage.platform` "Stage platform / riser" in `builders/stage/platform.ts`: params `width` 0.5–20 (2), `depth` 0.5–20 (1), `height` 0.1–3 (0.6). Deck slab of thickness `min(0.1, height)` on top (slot `body`, the material slot), skirt-free; square legs 0.06 m (slot `metal`) at the corners and on a grid at most 2 m apart (`ceil(width / 2) + 1` × `ceil(depth / 2) + 1` legs); centered on x/z, bottom at y = 0; `size = [width, height, depth]`; keywords ["stage", "platform", "riser", "podium", "deck"]
- [X] T073 [P] [US4] `stage.stairs` "Stairs" in `builders/stage/stairs.ts`: params `width` 0.5–5 (1) and `height` 0.15–3 (0.6). `steps = ceil(height / 0.20)`, rise = `height / steps`, tread 0.28 m; solid stringers on both sides (slot `metal`), treads slot `body`. The top step ends at z = 0 and the stairs extend towards −Z; bottom at y = 0, centered on x. `size = [width, height, steps × 0.28]`; keywords ["stairs", "steps", "staircase", "access"]
- [X] T074 [P] [US4] `stage.backdrop` "Backdrop / curtain" in `builders/stage/backdrop.ts`: params `width` 0.5–30 (6), `height` 0.5–15 (4), `style` curtain/flat (curtain). Curtain = a vertical surface with sinusoidal folds along X with fold spacing `width / max(1, round(width / 0.2))` and depth amplitude 0.05 m (tagged slot `body`, so material presets apply; default style dark fabric), plus a thin top pipe (slot `metal`). Flat = a 0.02 m thick panel. Centered on x, front facing +Z, bottom at y = 0; `size = [width, height, style === "curtain" ? 0.12 : 0.04]` (correct to the build; built: 0.10 / 0.02, see data-model.md); keywords ["backdrop", "curtain", "drape", "background", "molton"]
- [X] T075 [P] [US4] `stage.wall` "Wall" in `builders/stage/wall.ts`: params `width` 0.1–50 (4), `height` 0.1–15 (3), `thickness` 0.05–1 (0.2); one box; `size = [width, height, thickness]`; keywords ["wall", "room", "partition"]
- [X] T076 [P] [US4] `stage.floor` "Floor area" in `builders/stage/floor.ts`: params `width` 0.5–100 (10) and `depth` 0.5–100 (10); a box of thickness 0.01 m (top at y = 0.01); `size = [width, 0.01, depth]`; keywords ["floor", "ground", "dance floor", "area"]
- [X] T077 [P] [US4] Create `src/scene/editor/inspector/ParameterFields.vue`. Props: `definition: AssetDefinition` with a `parametric` source, and `params: ParamValues`. For each `ParamSpec`:
  - `number` → `InputNumber` with `min`/`max`/`step`, suffix from `unit` (" m", "°"), the help text `"<min> – <max> <unit>"` under it, and clamping on blur (`completeParams`);
  - `choice` → `Select`.
  - Emits `update(partialParams)`. Value changes while dragging or spinning call the store with the merge key `params:<id>`, so they form one undo step.
- [X] T078 [US4] Add the Parameters section (`ParameterFields`) to `src/scene/editor/inspector/LibraryAssetProperties.vue` for parametric assets → `store.setAssetParams(id, partial)`. Hide the **scale** fields of `TransformFields` for parametric library assets (show "Size is set by the parameters") and keep their scale at [1, 1, 1] (on load, `sanitize` resets the scale of parametric `libraryAsset` objects to [1, 1, 1])
- [X] T079 [US4] Render previews for the 8 stage elements and add them to `public/asset-library/previews/`

**Checkpoint**: Quickstart scenario 8 passes in both targets. Extreme values are clamped to the ranges shown in the inspector. Reloading keeps the parameters (US4-4).

---

## Phase 7: User Story 5 - Mount fixtures and connect truss with snapping (Priority: P2)

**Goal**: While dragging, fixtures snap to truss chords and platform tops and become children of them; truss segments connect end to end; Ctrl disables both.

**Independent Test**: Hang four moving heads under a truss and connect three truss segments plus a corner, using only drag & drop, then move the truss and confirm the fixtures follow (quickstart scenarios 9, 10).

- [X] T080 [US5] Add mounting data to `src/assetLibrary/catalog/stage.ts`:
  - `mountingAreas` for `stage.truss-straight` (every chord from `trussChordLines`; bottom chords `modes: ["hang"]`, top chords `["stand"]`; flat truss: both chords `["hang", "stand"]`), for `stage.truss-corner` (the chords of both legs, same rule) and for `stage.truss-tower` (none; the top block gets connection points);
  - `{ type: "surface", center: [0, height, 0], size: [width, depth], normal: [0, 1, 0], modes: ["stand"] }` for `stage.platform`;
  - `connections` for straight truss (`end-a` at (−L/2, h/2, 0) with direction (−1, 0, 0), `end-b` at (+L/2, h/2, 0) with direction (+1, 0, 0), up (0, 1, 0), type `truss.<profile>-290`), for the corner (one point at the end of each leg) and for the tower (four points on the sides of the top block, directions ±X / ±Z, type `truss.square-290`).
  - Check them in the workbench overlay.
- [X] T081 [US5] Create `src/scene/editor/snapping.ts`, class `SnapResolver` (research R8; contracts/library-ui.md → Snapping):
  - `collectTargets(scene, view, excludeIds)` computes the world-space mounting areas and connection points of all visible, unlocked `libraryAsset` objects, using `getWorldMatrix` from `transformMath` and the definitions' static `mounting` or `mountingAreas(params)` / `connections(params)`; cached per history version.
  - `resolveFixture(def: FixtureAssetDefinition, scale, pointerPoint)`: for each `line` area, find the closest point on the segment; candidate if its distance to `pointerPoint` is ≤ **0.3 m**. Mode = `hang` if the pointer is below the chord's center and `hang` is allowed, otherwise `stand` if allowed. Transform: **hang** = fixture flipped (rotation X 180°) with yaw aligned so the fixture's local X follows the chord direction, positioned so the mounting point lies at chord point − up × radius; **stand** = upright, mounting point at chord point + up × radius. For `surface` areas: candidate when the pointer is within the rectangle (expanded by 0.3 m) and within 0.3 m above or below it; stand on it at the projected point.
  - `resolveTruss(def, params, dragTransform)`: for each free, type-compatible connection point of other objects within **0.3 m** of any of the dragged element's own connection points (world positions at the current drag transform), compute the rotation that makes the directions opposite and the up vectors equal, then the translation that makes the points coincide.
  - Nearest candidate wins. Returns `SnapResult { kind: "hang" | "stand" | "connect"; targetId; position; rotation (deg, world); highlight: { type: "line" | "rect" | "point", ... }; label }`.
  - A point is **free** if no compatible point of another object lies within 1 cm.
- [X] T082 [US5] Integrate snapping into the library drag in `src/scene/editor/assetDrop.ts`: set `resolveSnap` so fixtures use `resolveFixture` and truss elements (`stage.truss-*`) use `resolveTruss`, unless **Ctrl** is held (`event.ctrlKey` on dragover; FR-043). Show a highlight on `EDITOR_LAYER` (a thick accent-colored line along the chord, a rect outline or a small sphere) and the status hint. On drop with a result: create the object with the snapped **world** transform, converted to local coordinates of the target for `hang`/`stand` with `reparentKeepingWorld` logic, and set `parentId = targetId` in the same `addObjects` call, so it is **one** undo step "Add <name>". Extend `store.addLibraryAsset`, `store.addFixtureModel` and `addAssetById` with an optional `{ parentId, worldTransform }`
- [X] T083 [US5] Integrate snapping into gizmo translation in `src/scene/editor/editorOverlay.ts`. When exactly one object is selected and it is a fixture visualization or a `stage.truss-*` library asset, on each TransformControls `objectChange` during a translate drag (and not while Ctrl is held), call the resolver with the dragged object's current world position (fixtures: the mounting point) and, if there is a result, override the preview transform with the snapped one and show the highlight. On drag end with a fixture result, commit the transform **and** `store.reparent([id], targetId)` as one history entry (extend `commitPreview` with an optional reparent so both changes form one entry). Truss results only change the transform. Ctrl pressed or released mid-drag re-evaluates immediately
- [X] T084 [P] [US5] Add the status hint to `src/scene/editor/Viewport.vue`: a small overlay at the bottom center that shows `SnapResult.label` while a candidate is active ("Hang on <name>", "Stand on <name>", "Connect to <name>") and is hidden otherwise. The overlay exposes it through a reactive `snapHint` ref

**Checkpoint**: Quickstart scenarios 9 and 10 pass in both targets. The show window follows mounted fixtures.

---

## Phase 8: User Story 6 - Decoration assets (Priority: P2)

**Goal**: Every FR-030 decoration item is available, with color variants where offered.

**Independent Test**: Build a band stage and a DJ setup using only library decoration and confirm every listed decoration type is available (quickstart scenario 11).

All builders go into `src/assetLibrary/builders/decoration/`, all definitions into `src/assetLibrary/catalog/decoration.ts`, with the sizes and variants from data-model.md → Library inventory, at least 3 keywords each, and the asset gate. Variants recolor slots (`body` = main color). Builder files can be written in parallel; add the definitions one after another.

- [ ] T085 [P] [US6] `decoration.line-array` "Line array (hanging)": 6 trapezoid-section boxes in a slight J-curve under a fly bar. The standard base-point rule applies (lowest point at y = 0), so the user lifts it into place after dropping it; variants black, white; keywords ["line array", "pa", "speaker", "hanging", "sound"]
- [ ] T086 [P] [US6] `decoration.monitor-wedge` "Stage monitor (wedge)": a wedge-shaped cabinet facing +Z and up at 40°, with a grille; variant black; keywords ["monitor", "wedge", "foldback", "speaker"]
- [ ] T087 [P] [US6] `decoration.dj-booth` "DJ booth": a 2.0 × 1.1 × 0.8 m booth with a front facade panel (slot `body`), a top surface and a side wing; variants black, white; keywords ["dj booth", "booth", "dj", "riser", "facade"]
- [ ] T088 [P] [US6] `decoration.dj-table` "DJ table with decks": a table with two turntables/CDJs and a mixer in the middle (slot `screen` for the jog displays); variant black; keywords ["dj", "decks", "turntable", "cdj", "mixer", "table"]
- [ ] T089 [P] [US6] `decoration.drum-kit` "Drum kit": procedural first — bass drum (front +Z), snare, two toms, floor tom, hi-hat and two cymbals on stands, and a stool (slots `body` = shells, `metal`, `accent` = drum heads). Decide by visual quality whether to replace it with a CC0 GLB (Quaternius/Kenney/Poly Haven; record the credits and license, put the file in `public/asset-library/models/drum-kit.glb`, ≤ 1 MB). Variants black, red; keywords ["drums", "drum kit", "band", "percussion"]
- [ ] T090 [P] [US6] `decoration.amp` "Guitar/bass amplifier": a 4 × 12" cabinet with a head on top, grille front (+Z); variant black; keywords ["amp", "amplifier", "guitar", "bass", "cabinet", "stack"]
- [ ] T091 [P] [US6] `decoration.keyboard-stand` "Keyboard on stand": an X-stand with an 88-key keyboard (white/black keys as two slots `accent` and `body`); keywords ["keyboard", "piano", "synth", "stand"]
- [ ] T092 [P] [US6] `decoration.mic-stand` "Microphone stand": a tripod base, a vertical pole of 1.0 m, a boom arm and a microphone; slots `metal`, `body`; keywords ["mic", "microphone", "stand", "vocal"]
- [ ] T093 [P] [US6] `decoration.bar-counter` "Bar counter": a 3.0 × 1.1 × 0.7 m counter with a top overhang and a foot rail (slot `metal`); variants wood, black; keywords ["bar", "counter", "drinks", "furniture"]
- [ ] T094 [P] [US6] `decoration.figure-standing` "Human figure (standing)": a stylized mannequin (capsule limbs, sphere head) 1.78 m tall, facing +Z (procedural first; a CC0 GLB is optional by the same rule as T089); slot `body`; variant grey; keywords ["human", "person", "figure", "people", "scale", "audience"]
- [ ] T095 [P] [US6] `decoration.figure-arms-up` "Human figure (arms raised)": the same mannequin with both arms raised (total height 2.15 m); share the limb-building helper with T094 in `builders/decoration/figure.ts`; keywords ["human", "person", "figure", "crowd", "party", "arms up"]
- [ ] T096 [US6] Add the **Variant** select to `src/scene/editor/inspector/LibraryAssetProperties.vue` for assets with `variants` (options: "Default" = `null` plus the variants by name) → `store.setAssetVariant`. Add a **Color** picker with **Reset** for non-parametric assets that have a `body` slot → `store.setAssetColor` (contracts/library-ui.md → Library asset)
- [ ] T097 [US6] Render previews for all decoration assets and add them to `public/asset-library/previews/`

**Checkpoint**: Quickstart scenario 11 passes in both targets. All 14 decoration items from FR-030 are in the library (counting T027–T029 from US1).

---

## Phase 9: User Story 7 - Materials and colors for stage elements (Priority: P3)

**Goal**: Material presets for basic shapes and parametric stage elements, combined with a free color choice.

**Independent Test**: Apply each material preset to a box under a moving head beam and confirm each looks distinct (quickstart scenario 12).

- [ ] T098 [P] [US7] Create `src/scene/editor/inspector/MaterialField.vue`. Props `material: MaterialPresetId | null` and `color: string`; a `Select` with "None (color only)" plus the 7 presets by name (each with a small color swatch) and a `ColorPicker`. It emits `update:material` and `update:color`
- [ ] T099 [US7] Use `MaterialField` in `src/scene/editor/inspector/ShapeProperties.vue` (above the existing color field, replacing it) → `store.setShapeMaterial` / the existing color update, and in `src/scene/editor/inspector/LibraryAssetProperties.vue` for assets with `supportsMaterial` → `store.setAssetMaterial` / `store.setAssetColor`. For library assets, the color shown is `object.color ?? the body slot color of resolveSlotStyle`
- [ ] T100 [US7] Make sure material changes rebuild correctly in the views: `libraryAsset` already re-keys its template on `material`/`color` (T024); check that shape materials update in place (T025), including switching back to `null`. Tune the presets in `src/assetLibrary/materials.ts` under a moving head beam until the seven are clearly distinct, and update the table in research.md R14 if any value changes

**Checkpoint**: Quickstart scenario 12 passes in both targets.

---

## Phase 10: User Story 8 - See where assets come from (Priority: P3)

**Goal**: An "Asset credits" view lists every built-in asset with author, source and license.

**Independent Test**: Open the credits view and confirm every asset in the library has author, source and license (quickstart scenario 13).

- [ ] T101 [P] [US8] Create `src/scene/editor/library/AssetCreditsDialog.vue` (contracts/library-ui.md → Asset credits dialog): a modal `Dialog` titled "Asset credits", with the intro line "Built-in 3D assets and their licenses." and a list grouped by category in catalog order. Each row shows name, author, source (a link if it starts with `http`, opened with `target="_blank" rel="noopener"`, which works in both targets because Electron's window-open handling already routes external links; if it doesn't, use the native adapter's link opening), the license as an SPDX id linked to `https://spdx.org/licenses/<id>.html`, and the badge "made for LEDMusic Studio" when `madeForProject`. Read-only
- [ ] T102 [US8] Wire the panel's ⋮ → "Asset credits" (`showCredits` from T031) to open `AssetCreditsDialog` in `src/scene/editor/SceneEditor.vue`. If any third-party GLB was added (T089, T094, T095), make sure its license text is in `public/asset-library/LICENSES/` when the license is Apache-2.0, and that its credits name the original author and URL

**Checkpoint**: Quickstart scenario 13 passes; the count of listed assets equals `assetCatalog.all().length` (SC-008).

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Previews, validation, performance, size, documentation and the final manual verification.

- [ ] T103 Run the asset workbench over the whole catalog and fix everything until the summary reads "<N> assets, 0 errors". Re-render all previews in one go so they look consistent, and replace the files in `public/asset-library/previews/`
- [ ] T104 Check the asset inventory against the spec: every id from data-model.md → Library inventory exists (19 fixtures, 8 stage, 14 decoration, 4 shapes; SC-001). Update data-model.md where sizes were corrected during implementation (T053–T056, T069, T074)
- [ ] T105 Build the SC-004 scene (300 objects, 60 fixture visualizations including 20 LED panels or pixel bars, 100 chairs) and measure orbiting and playback in both targets on the reference machine (001 R15). If it is not smooth: first lower builder segment counts, then add the instancing path for static assets used more than 20 times as described in research R6 (in `src/visualization/sceneView.ts`). Record the fps in the commit message
- [ ] T106 [P] Compare `dist/` size before (on the commit before this feature) and after `pnpm build`; growth must be ≤ 25 MB (SC-007)
- [ ] T107 [P] Check for leaks over repeated open/close of the show window and repeated project loads with many library assets (DevTools memory snapshot, `renderer.info.memory` geometries/textures counts back to baseline), as in 001 FR-062. Fix missing `release()` calls in `AssetCache` users
- [ ] T108 [P] Remove leftovers: search `src/` for `createEditorProxy` uses that are no longer needed (spot), unused imports, and `TODO(002)` notes. Make sure `src/assetLibrary` has no Pinia/Vue imports (`grep -r "pinia\|from \"vue\"" src/assetLibrary` must find only `workbench/`)
- [ ] T109 Update `specs/002-asset-library/spec.md` status to "Implemented" and add a short note to `README.md` (if it has a features section) about the asset library and the asset workbench (`pnpm dev` → `/asset-workbench.html`)
- [ ] T110 Run `pnpm lint` and `pnpm build`; both must pass
- [ ] T111 Carry out all 20 scenarios of `specs/002-asset-library/quickstart.md` in the browser (`pnpm dev` and `pnpm build && pnpm serve`) and in Electron (`pnpm electron:dev`); note any failure as a new task. The commit message must mention that the old moving head model was removed, so moving heads in existing projects get a new body (position, aim and mapping are kept)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. **Blocks all user stories.**
- **US1 (Phase 3)**: depends on Foundational. MVP.
- **US2 (Phase 4)**: depends on Foundational. Uses the library panel from US1 only to drop fixture models (T048 turns them on), so it can be built in parallel with US1 and checked through the Add fixture visualization dialog alone.
- **US3 (Phase 5)**: depends on Foundational and on US2's T049 (category mapping), T043/T044 (renderers, for Spot-capable models).
- **US4 (Phase 6)**: depends on Foundational and on US1's T035 (library asset inspector) and T033/T034 (placing).
- **US5 (Phase 7)**: depends on US4 (truss and platform definitions) and US2 (fixture models with mounting points); US1 for drag & drop.
- **US6 (Phase 8)**: depends on US1 (catalog file, inspector). Independent of US2–US5.
- **US7 (Phase 9)**: depends on Foundational (T025, T005) and US1 (T035); US4 for stage elements to test with (shapes alone are enough to check).
- **US8 (Phase 10)**: depends on US1 (T031). Can be done any time after it.
- **Polish (Phase 11)**: after all desired stories.

### User Story Dependency Graph

```text
Setup → Foundational ─┬─ US1 (MVP) ─┬─ US4 ── US5
                      │             ├─ US6
                      │             ├─ US7
                      │             └─ US8
                      └─ US2 ─── US3      (US5 also needs US2)
```

### Within Each User Story

- Builder files before their catalog definitions; definitions before previews.
- Store commands before the inspector components that call them.
- Every asset task ends with the asset gate.

### Parallel Opportunities

- Phase 2: T004, T005, T006, T009, T010 in parallel; T018 and T019 in parallel once T014 exists.
- US1: T026–T029 (assets), T030 and T036 (components) in parallel.
- US2: T038–T041 (models) and T049 (mapping) in parallel.
- US3: all builder files T052–T064 in parallel (definitions are then added one after another to `catalog/fixtures.ts`).
- US4: T068, T072–T077 in parallel; T069–T071 after T068.
- US6: T085–T095 builder files in parallel.
- US1, US2, US6 and US8 can be worked on in parallel after Foundational.

---

## Parallel Example: User Story 3

```text
# Write all fixture builders together (different files):
Task: "fixture.wash-fresnel in src/assetLibrary/builders/fixtures/washFresnel.ts"
Task: "fixture.scanner in src/assetLibrary/builders/fixtures/scanner.ts"
Task: "fixture.led-panel in src/assetLibrary/builders/fixtures/ledPanel.ts"
Task: "fixture.laser in src/assetLibrary/builders/fixtures/laser.ts"
# Then add their definitions to src/assetLibrary/catalog/fixtures.ts one by one and run the asset gate.
```

## Parallel Example: User Story 1

```text
Task: "shape.* definitions in src/assetLibrary/catalog/shapes.ts"
Task: "decoration.table builder in src/assetLibrary/builders/decoration/table.ts"
Task: "decoration.speaker-stack builder in src/assetLibrary/builders/decoration/speakerStack.ts"
Task: "AssetTile.vue in src/scene/editor/library/AssetTile.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup.
2. Phase 2: Foundational (catalog, cache, validator, workbench, FixtureBody, Generic Fixture, scene model).
3. Phase 3: US1 (library panel, drag & drop, a handful of assets).
4. **Stop and validate**: quickstart scenarios 1–3 and 14 in both targets. Commit.

### Incremental Delivery

1. Setup + Foundational → foundation ready (commit).
2. US1 → place assets (MVP, commit).
3. US2 → moving head/spot/LED strip on the contract, old GLB gone, model selection and preselection (commit; mention the moving head body change).
4. US3 → all fixture categories (commit).
5. US4 → parametric stage; US5 → snapping (commit each).
6. US6 → decoration; US7 → materials; US8 → credits (commit each).
7. Polish → full quickstart in both targets.

---

## Notes

- [P] tasks = different files, no dependencies on unfinished tasks.
- The [Story] label maps each task to its user story for traceability.
- Commit after each task or logical group; `pnpm lint` and `pnpm build` must pass for every commit to `main`.
- Stop at any checkpoint to validate the story on its own.
- Avoid vague tasks, edits of the same file in parallel, and cross-story dependencies that break independence.
