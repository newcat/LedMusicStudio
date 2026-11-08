# Data Model: Asset Library & Model Contract

**Feature**: 002-asset-library | **Date**: 2026-11-08 | **Plan**: [plan.md](./plan.md)

Conventions from feature 001 still apply: meters, degrees, +Y up, floor at y = 0, Euler XYZ, transforms relative to the parent. Typed definitions: [contracts/asset-catalog.ts](./contracts/asset-catalog.ts) (library, shipped with the app) and [contracts/scene-state-delta.ts](./contracts/scene-state-delta.ts) (changes to the persisted scene).

There are two kinds of data:

- **Catalog data** ships with the app, is read-only and is never written into project files.
- **Scene data** is persisted in `SavedState.stage.scene` and refers to catalog data only by id.

---

## Catalog data (read-only, `src/assetLibrary`)

### Asset (`AssetDefinition`)

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable, unique, `^[a-z]+(\.[a-z0-9-]+)+$`, prefixed by category (`fixture.`, `stage.`, `decoration.`, `shape.`). Never reused for a different object. |
| `name` | string | Shown in the library and the inspector. |
| `category` | `"fixtures" \| "stage" \| "decoration" \| "shapes"` | Library section. |
| `keywords` | string[] | ≥ 1; used by search (FR-002). |
| `defaultSize` | Vec3 | Bounding box in meters at default parameters; validator tolerance ±15 % (FR-004). |
| `preview` | string | `asset-library/previews/<id>.webp`. |
| `credits` | `Credits` | Required (FR-060). |
| `source` | `GlbSource \| ProceduralSource \| ParametricSource \| ShapeSource` | How the asset is built. |
| `fixture` | `FixtureModelDescription?` | Required if and only if `category === "fixtures"`. |
| `materialSlots` | `MaterialSlot[]?` | Names of the recolorable parts (`body`, `accent`, …). |
| `variants` | `ColorVariant[]?` | Optional color variants (FR-033). |
| `supportsMaterial` | boolean? | true for parametric stage elements (and shapes), which take a material preset (FR-050). |
| `mounting` | `{ areas, connections }?` | Static mounting areas and connection points (FR-040); parametric elements provide functions instead. |

**Base point**: the asset's local origin. The built geometry's lowest point is at y = 0 and the asset is horizontally centered on the origin, unless the definition says otherwise, for example for a stage platform that is anchored at a corner. This is enforced by the validator.

### Credits

| Field | Type | Rules |
|---|---|---|
| `author` | string | Non-empty. |
| `source` | string | URL or "LEDMusic Studio". |
| `license` | `"GPL-3.0-or-later" \| "CC0-1.0" \| "CC-BY-4.0" \| "Apache-2.0" \| "MIT"` | Allow-list (research R11). |
| `madeForProject` | boolean | true ⇒ license `GPL-3.0-or-later`. |

### Fixture Model Description (`FixtureModelDescription`)

All positions and directions are given in the frame of the named node. `""` is the model root.

| Field | Type | Rules |
|---|---|---|
| `visualizationTypes` | `VisualizationType[]` | ≥ 1; each must meet its role requirements (below). |
| `categories` | OFL category[] | The fixture categories the model suits (used by category mapping and as a filter hint). |
| `movingParts.pan` | `MovingPart?` | `{ node, axis: "x"\|"y"\|"z", min, max }` in degrees, `min < max`. |
| `movingParts.tilt` | `MovingPart?` | Same; the tilt node must be a descendant of the pan node, if both exist. |
| `beam` | `{ node, position: Vec3, direction: Vec3 }?` | `direction` is a unit vector. At rest the beam points to world +Y for standing models (research R3). |
| `lensRadius` | number | > 0, meters. |
| `emitters` | `Emitter[]` | ≥ 1, ids unique. |
| `mountingPoints` | `MountingPoint[]` | ≥ 1. |
| `ledStrip` | `{ profileWidth, profileHeight }?` | Only for LED strip bodies (parametric along start → end). |

**Role requirements per visualization type** (research R7):

| Type | Requires |
|---|---|
| Moving Head | `movingParts.pan`, `movingParts.tilt`, `beam` |
| Spot | `beam` |
| Generic Fixture | ≥ 1 emitter (always true) |
| Led Strip | `ledStrip`, parametric source with a `length` parameter |

### Emitter

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique within the model; cells use `cell-<row>-<col>` or `cell-<n>` so feature 003 can address them. |
| `node` | string | Must exist; emitters on moving heads hang on the tilt node. |
| `shape` | `"circle" \| "rect"` | |
| `position` | Vec3 | Center of the emitting face. |
| `normal` | Vec3 | Unit vector; the face emits towards it. |
| `radius` / `size` | number / `[w, h]` | > 0; `size` for rect, with `up` (Vec3) giving the orientation of `h`. |

### Moving part

`{ node: string; axis: "x" | "y" | "z"; min: number; max: number }`. The pivot is the node origin. A positive value rotates counterclockwise about the axis when viewed from its positive end (Three.js convention). Physical limits (`min`, `max`) are used as the default channel mapping ranges when a visualization is created.

### Mounting point (fixtures)

`{ id: string; node: string; position: Vec3; direction: Vec3 }`. `direction` is the outward normal of the clamp face. For a standing fixture with a base plate, this is `[0, −1, 0]` at the base center. Used for both stand and hang (hang flips the fixture, research R8).

### Mounting area (truss, platforms)

| Variant | Fields |
|---|---|
| `line` | `id`, `start: Vec3`, `end: Vec3`, `radius` (tube radius), `modes: ("hang" \| "stand")[]` |
| `surface` | `id`, `center: Vec3`, `size: [w, d]`, `normal: Vec3`, `modes: ["stand"]` |

### Connection point (truss elements)

`{ id: string; position: Vec3; direction: Vec3; up: Vec3; type: string }`. `direction` points out of the element. Only equal `type`s connect (for example `truss.square-290`, `truss.triangle-290`, `truss.flat-290`). A point is **free** if no compatible point of another object lies within 1 cm of it in world space.

### Parametric element (`ParametricSource`)

| Field | Type | Rules |
|---|---|---|
| `params` | `ParamSpec[]` | `number` (`min`, `max`, `step`, `unit`, `default`) or `choice` (`options`, `default`). |
| `size(params)` | `(p) => Vec3` | Pure, no Three.js; must match the built bounding box ±2 %. |
| `build(params, kit)` | `(p, kit) => Object3D` | Deterministic for equal params. |
| `mountingAreas(params)` | function? | World-independent (local frame). |
| `connections(params)` | function? | Local frame. |

#### Parametric element parameters

Values outside a range are clamped by the inspector and by `sanitize` (FR-032, edge case "extreme value").

| Asset id | Parameter | Range | Default | Repeating module |
|---|---|---|---|---|
| `stage.platform` | width / depth / height | 0.5–20 / 0.5–20 / 0.1–3 m | 2 / 1 / 0.6 | legs ≤ 2 m apart |
| `stage.stairs` | width / height | 0.5–5 / 0.15–3 m | 1 / 0.6 | steps = ceil(height / 0.20), tread 0.28 m |
| `stage.truss-straight` | length / profile | 0.25–30 m / flat, triangle, square | 2 / square | bay 0.5 m nominal (n = round(L / 0.5) ≥ 1) |
| `stage.truss-corner` | profile | flat, triangle, square | square | fixed 90°, legs 0.5 m |
| `stage.truss-tower` | height | 1–8 m | 3 | bay 0.5 m; base plate 0.8 × 0.8 m; top block with 4 side connection points |
| `stage.backdrop` | width / height / style | 0.5–30 / 0.5–15 m / curtain, flat | 6 / 4 / curtain | fold 0.2 m (curtain) |
| `stage.wall` | width / height / thickness | 0.1–50 / 0.1–15 / 0.05–1 m | 4 / 3 / 0.2 | — |
| `stage.floor` | width / depth | 0.5–100 / 0.5–100 m | 10 / 10 | — |
| `fixture.led-profile` (internal, LED strip body) | length | 0.05–50 m (from start/end) | — | — |

All truss profiles are 0.29 m wide, with chord tubes ⌀ 50 mm and braces ⌀ 20 mm.

### Material preset

`{ id: MaterialPresetId; name; color; roughness; metalness; sheen?; clearcoat? }`. Ids: `stage-floor-black`, `wood`, `metal-brushed`, `fabric-black`, `fabric-white`, `concrete`, `plastic-glossy` (values: research R14).

### Library inventory (SC-001)

Default sizes are W × H × D in meters. "P" = procedural, "G" = GLB file, "Par" = parametric. Visualization types: MH = Moving Head, S = Spot, Gen = Generic Fixture, LS = Led Strip.

**Fixtures** (FR-020, FR-021)

| Id | Name | Src | Types | Size | Emitters |
|---|---|---|---|---|---|
| `fixture.par-can` | Par can | P | S, Gen | 0.25 × 0.35 × 0.25 | lens |
| `fixture.wash-fresnel` | Wash (Fresnel) | P | S, Gen | 0.3 × 0.4 × 0.3 | lens |
| `fixture.profile-spot` | Profile spot (ellipsoidal) | P | S, Gen | 0.25 × 0.4 × 0.7 | lens |
| `fixture.moving-head-beam` | Moving head (beam) | P | MH | 0.3 × 0.5 × 0.25 | lens |
| `fixture.moving-head-spot` | Moving head (spot/beam) | P | MH | 0.35 × 0.6 × 0.3 | lens |
| `fixture.moving-head-wash` | Moving head (wash) | P | MH | 0.4 × 0.55 × 0.35 | lens (+ 7 LED cells) |
| `fixture.scanner` | Scanner | P | MH | 0.25 × 0.25 × 0.7 | mirror aperture |
| `fixture.strobe` | Strobe | P | Gen | 0.5 × 0.2 × 0.15 | tube |
| `fixture.blinder` | Blinder (4 cells) | P | Gen | 0.5 × 0.5 × 0.2 | `cell-1`..`cell-4` |
| `fixture.led-bar` | LED bar / batten | P | Gen, S | 1.0 × 0.1 × 0.1 | `cell-1`..`cell-8` |
| `fixture.pixel-bar` | Pixel bar | P | Gen | 1.0 × 0.06 × 0.06 | `cell-1`..`cell-16` |
| `fixture.led-panel` | LED panel | P | Gen | 0.5 × 0.5 × 0.08 | `cell-r-c` (8 × 8) |
| `fixture.laser` | Laser | P | Gen | 0.25 × 0.15 × 0.3 | aperture |
| `fixture.flame-projector` | Flame projector | P | Gen | 0.3 × 0.4 × 0.3 | nozzle |
| `fixture.co2-jet` | CO2 jet | P | Gen | 0.2 × 0.4 × 0.2 | nozzle |
| `fixture.cold-spark` | Cold spark machine | P | Gen | 0.35 × 0.25 × 0.35 | nozzle |
| `fixture.fog-machine` | Fog machine / hazer | P | Gen | 0.5 × 0.25 × 0.25 | nozzle |
| `fixture.generic` | Generic fixture | P | Gen, S | 0.25 × 0.3 × 0.25 | lens |
| `fixture.led-profile` | LED strip profile | Par | LS | length × 0.02 × 0.02 | — (LED strip lighting) |

**Stage** (FR-031): the 8 parametric elements in the table above.

**Decoration** (FR-030)

| Id | Name | Src | Size | Variants |
|---|---|---|---|---|
| `decoration.speaker-stack` | Speaker stack | P | 0.6 × 1.8 × 0.6 | black, white |
| `decoration.line-array` | Line array (hanging) | P | 0.7 × 1.6 × 0.5 | black, white |
| `decoration.monitor-wedge` | Stage monitor (wedge) | P | 0.55 × 0.35 × 0.45 | black |
| `decoration.dj-booth` | DJ booth | P | 2.0 × 1.1 × 0.8 | black, white |
| `decoration.dj-table` | DJ table with decks | P | 1.2 × 0.95 × 0.6 | black |
| `decoration.drum-kit` | Drum kit | G or P | 2.0 × 1.3 × 1.6 | black, red |
| `decoration.amp` | Guitar/bass amplifier | P | 0.75 × 1.3 × 0.4 | black |
| `decoration.keyboard-stand` | Keyboard on stand | P | 1.3 × 0.95 × 0.45 | — |
| `decoration.mic-stand` | Microphone stand | P | 0.5 × 1.6 × 0.5 | — |
| `decoration.table` | Table | P | 1.2 × 0.75 × 0.8 | wood, black |
| `decoration.chair` | Chair | P | 0.45 × 0.85 × 0.5 | wood, black |
| `decoration.bar-counter` | Bar counter | P | 3.0 × 1.1 × 0.7 | wood, black |
| `decoration.figure-standing` | Human figure (standing) | G or P | 0.5 × 1.78 × 0.3 | grey |
| `decoration.figure-arms-up` | Human figure (arms raised) | G or P | 0.6 × 2.15 × 0.3 | grey |

**Basic shapes** (FR-006): `shape.box`, `shape.cylinder`, `shape.plane`, `shape.sphere` (source `shape`, they call `addShape`).

---

## Scene data (persisted, extends feature 001)

### New object kind: `libraryAsset`

| Field | Type | Rules |
|---|---|---|
| (base fields) | | As in 001 (`id`, `name`, `parentId`, `children`, transform, `visible`, `locked`). |
| `assetId` | string | Catalog id. Unknown ⇒ placeholder (FR-070), and the object is kept as it is. |
| `params` | `Record<string, number \| string>` | Parametric only; otherwise `{}`. Clamped to ranges on load and on edit. Unknown keys are dropped, missing ones get their defaults. |
| `material` | `MaterialPresetId \| null` | Only if `supportsMaterial`; otherwise `null`. |
| `color` | `"#rrggbb" \| null` | Override of the `body` slot; `null` = asset default. |
| `variant` | `string \| null` | Must be one of the asset's variants; otherwise `null`. |
| `size` | Vec3 | Bounding size at the last edit; set by the store from `defaultSize` or `size(params)`; used for the placeholder. Each component ≥ 0.01. |

### Changed kind: `fixtureVisualization`

| Field | Type | Rules |
|---|---|---|
| `modelId` | string | Catalog id of a fixture model compatible with `visualizationType`. On load, a missing or incompatible id becomes the type's default model (see below). An unknown id is **kept** and rendered with the generic fallback body plus a warning, so a newer project file is not changed silently. |
| `modelScale` | number | 0.25–4, default 1. |

Default model per type: Moving Head → `fixture.moving-head-spot`, Spot → `fixture.par-can`, Generic Fixture → `fixture.generic`, Led Strip → `fixture.led-profile`.

New visualization type `Generic Fixture`, config:

```text
GenericVisualizationConfig {
  channelMapping: {
    intensity: ChannelMapping   // default: channel -1, defaultValue 1, min 0, max 1
    red: number; green: number; blue: number; white: number   // -1 = not mapped
  }
}
```

Unmapped color ⇒ white; unmapped intensity ⇒ full (FR-022).

### Changed kind: `shape`

| Field | Type | Rules |
|---|---|---|
| `material` | `MaterialPresetId \| null` | Default `null` (plain color as in 001). |

---

## Invariants

1. A project file never contains catalog geometry, previews or descriptions, only ids and parameters (FR-005).
2. `fixtureVisualization.modelId` always names a model whose description lists the object's `visualizationType` (or an unknown id, see above). `setVisualizationType` also resets `modelId` to the new type's mapped or default model.
3. A `libraryAsset` with `params` always has every parameter of its definition, each within its range.
4. Switching `modelId` changes nothing except `modelId` and possibly `modelScale` (US2-3, FR-013).
5. Objects mounted by snapping are ordinary children (`parentId`) of the mounting object. Deleting the parent deletes them with it (001 behavior, undoable), and the DMX fixture behind a visualization is not deleted.

## State transitions

### Library asset lifecycle

```text
 (drag from library) ──drop──▶ placed (selected)
       │ Esc / drag leave            │ edit params/material/variant ──▶ rebuilt (same id, one undo step)
       ▼                             │ delete ──▶ removed (undo restores)
   no object                         │ load with unknown assetId ──▶ placeholder (size from `size`)
                                     │                                  │ "Replace asset…" ──▶ placed (new assetId,
                                     │                                  │   transform, parent and children kept)
```

### Fixture visualization model

```text
 created (type + model preselected by category mapping, modelScale from dimensions)
   ├─ choose model ──▶ same object, new modelId (modelScale recomputed if the fixture has dimensions)
   ├─ change visualization type ──▶ new type, default config, mapped/default modelId
   └─ "Reset to model size" ──▶ modelScale = 1
```

### Snapping during a drag

```text
 free ──(within 0.3 m of a compatible area or point, Ctrl not held)──▶ candidate (highlight, ghost jumps)
 candidate ──(moves away / Ctrl pressed)──▶ free
 candidate ──release──▶ committed: transform set; for mounting: reparented to the target (world transform kept)
 free ──release──▶ committed at the surface point (001 behavior)
```

## Load rules (`sanitize.ts` additions)

1. `libraryAsset`: base fields as in 001. `assetId` must be a string (otherwise the object becomes a `group` and a problem is recorded). `params`, `material`, `color`, `variant` and `size` are fixed as described above. For unknown assets, `params`, `variant` and `material` are kept as they are, so a newer file is not changed.
2. `fixtureVisualization` without `modelId` (saved by 001): `modelId` = default for its type, `modelScale = 1`. For type Spot, additionally `rotation = rotation ∘ Rx(180°)` (research R3).
3. `shape` without `material`: `material = null`.
4. Unknown preset ids ⇒ `null`; unknown variant ids ⇒ `null`.
