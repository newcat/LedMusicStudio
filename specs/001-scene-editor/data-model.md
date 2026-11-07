# Data Model: Scene Model & 3D Scene Editor

**Feature**: 001-scene-editor | **Date**: 2026-11-07 | **Plan**: [plan.md](./plan.md)

The TypeScript shape of the persisted data is the contract in [contracts/scene-state.ts](./contracts/scene-state.ts). This document explains entities, rules and state transitions.

## Coordinate convention (FR-004)

- Units: **meters** for distances, **degrees** for rotations stored in the file and shown in the inspector.
- Right-handed, **+Y up** (Three.js default), floor at **y = 0**. "Front" view looks along −Z (the camera stands at +Z), "Side" view looks along −X (camera at +X), "Top" view looks down −Y.
- Rotation is stored as Euler angles in degrees, order **XYZ**. Internally the editor works with quaternions and converts on write.
- Every transform is **relative to the parent** (local). Objects without a parent are relative to the scene root.

## Entities

### Scene (`SceneState`)

| Field | Type | Rules |
|---|---|---|
| `formatVersion` | `1` | Bumped when the scene format changes incompatibly. |
| `objects` | `Record<id, SceneObject>` | Flat map; hierarchy via `parentId`. |
| `rootOrder` | `id[]` | Order of top-level objects in the outliner. |
| `cameras` | `CameraPosition[]` | Saved camera positions, ordered. At most one has `isShowDefault: true`. |
| `editorCamera` | `CameraPose` | Last editor viewpoint, restored on load. |
| `settings` | `SceneEditorSettings` | Grid/axes/labels visibility, snapping on/off, snap steps. |
| `assets` | `Record<assetId, SceneAsset>` | Binary data of imported models (base64 in the file). |

**Default scene (FR-002)**: one shape object "Floor" (plane, 20 m × 20 m, color `#3a3a3a`, at the origin), one camera position "Default" (position `[8, 6, 12]`, target `[0, 1, 0]`, fov 50°) marked as show default, `editorCamera` equal to it, default settings (grid on, axes on, labels off, snapping off, 0.25 m, 15°, scale step 0.1).

### Scene Object (`SceneObject`)

Common fields of every kind:

| Field | Type | Rules |
|---|---|---|
| `id` | `string` (uuid v4) | Unique within the scene; never reused after paste/duplicate (new ids). |
| `name` | `string` | Non-empty after trimming; not required to be unique. Default: kind label + counter ("Box 3"). |
| `kind` | discriminator | See kinds below. |
| `parentId` | `string \| null` | Must reference an existing object; no cycles (an object cannot become a descendant of itself). |
| `children` | `id[]` | Order of children in the outliner; kept consistent with `parentId` by the store. |
| `position` | `[x, y, z]` | Meters, finite numbers. |
| `rotation` | `[x, y, z]` | Degrees, finite; normalized to (−180, 180]. |
| `scale` | `[x, y, z]` | Each component ≥ 0.01; no negative values. |
| `visible` | `boolean` | Hidden objects (and their descendants) are not rendered in editor or show window, are not pickable in 3D, and remain in the outliner. |
| `locked` | `boolean` | Locked objects cannot be picked or transformed in 3D; editable in outliner and inspector. |

Effective visibility = own `visible` AND all ancestors visible. Lock is **not** inherited (a child of a locked group can still be picked).

#### Kind `shape` (Basic Shape)

| Field | Type | Rules |
|---|---|---|
| `shape` | `"box" \| "cylinder" \| "plane" \| "sphere"` | |
| `dimensions` | per shape, meters | box `{ width, height, depth }`, cylinder `{ radius, height }`, plane `{ width, depth }`, sphere `{ radius }`; each ≥ 0.01. |
| `color` | `string` | `#rrggbb`. |

Geometry origin: box and cylinder sit **on** their origin (bottom face at local y = 0) so placing on a surface works without offset; plane lies in the local XZ plane facing +Y; sphere is centered at its origin and offset by its radius when placed on a surface.

Defaults: box 1 × 1 × 1 m, cylinder r 0.5 m h 1 m, plane 2 × 2 m, sphere r 0.5 m; color `#9e9e9e`.

#### Kind `fixtureVisualization`

| Field | Type | Rules |
|---|---|---|
| `fixtureId` | `string \| null` | References a fixture in `stage.fixtures`. At most one object per fixture. `null` = unlinked (after duplicate/paste, or after the fixture was deleted while an undo restored it). |
| `visualizationType` | `"Led Strip" \| "Spot" \| "Moving Head"` | Must be compatible with the linked fixture's type (existing `compatibleFixtures` check). |
| `config` | per type, see below | Type-specific; **no world placement fields**. |

Configs (changes compared to today in bold):

- **Moving head**: `channelMapping { pan, tilt, beamAngle: ChannelMapping; red, green, blue: number }`. **`position` and `rotation` removed.** Local orientation: base down (local −Y), beam along the head's axis as in the built-in model.
- **Spot**: `colorChannels: [r, g, b, w]`. **`position` and `target` removed.** Emits along local −Y.
- **LED strip**: `intensity`, `start`, `end` (**object-local**, meters). **`direction` removed**; the strip emits along the object's local +Y.

Linked objects own a `FixtureVisualizationController` (keyed by object id) that turns fixture values into renderer values; unlinked objects render as "off".

#### Kind `importedModel`

| Field | Type | Rules |
|---|---|---|
| `assetId` | `string` | References `assets[assetId]`; must exist. |
| `originalScale` | `[x, y, z]` | Scale before auto-scaling on import; used by "Restore original scale". |

#### Kind `group`

No extra fields. Rendered as nothing in the show window; the editor shows a small axes cross when selected.

#### Unknown kinds (forward compatibility, FR-005 / FR-061)

When a file contains an object whose `kind` this version does not know (e.g. written by a later version with feature 002), the object is kept as-is (all fields preserved on save), shown as a placeholder box labelled with its kind, and can be transformed, reparented and deleted but not otherwise edited.

### Scene Asset (`SceneAsset`)

| Field | Type | Rules |
|---|---|---|
| `id` | `string` (uuid v4) | |
| `name` | `string` | Original file name. |
| `mimeType` | `"model/gltf-binary"` | Only GLB in this feature. |
| `data` | base64 `string` in the file; `Uint8Array` in memory | |

Assets not referenced by any object (also none in the undo history) are removed on save.

### Camera Position (`CameraPosition`)

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | |
| `name` | `string` | Non-empty. |
| `position` | `[x, y, z]` | |
| `target` | `[x, y, z]` | Must differ from `position`. |
| `fov` | `number` | Vertical FOV in degrees, 10–120. |
| `isShowDefault` | `boolean` | Setting it on one position clears it on all others. If none is marked, the show window starts at the first position, else at `editorCamera`. |

### Editor Settings (`SceneEditorSettings`)

`showGrid`, `showAxes`, `showLabels`, `snapEnabled` (booleans); `translationSnap` (m, > 0), `rotationSnap` (deg, > 0), `scaleSnap` (> 0); `transformSpace: "world" | "local"`. Saved with the project; not part of undo.

### Session-only state (not saved)

- **Selection**: ordered list of object ids; the last selected is the *active* object. Shared between editor, outliner and the Fixtures list (selecting a fixture selects its visualization object and vice versa).
- **History**: undo and redo stacks of `HistoryEntry { label, before: Record<id, SceneObject | null>, after: Record<id, SceneObject | null> }`, max. 200 entries, cleared on project load/reset.
- **Clipboard**: copied object subtrees (with assets referenced by id).
- **Transform mode**: move / rotate / scale.

## Relationships

```text
Project (SavedState)
└── stage: StageState
    ├── fixtures[]  ──────────────┐ 0..1
    ├── controllers[]             │
    └── scene: SceneState         │
        ├── objects{} ── parentId (tree)
        │   ├── shape
        │   ├── fixtureVisualization ──fixtureId──┘
        │   ├── importedModel ──assetId──► assets{}
        │   └── group
        ├── cameras[]
        ├── editorCamera
        ├── settings
        └── assets{}
```

## Validation and invariants (enforced by store commands)

1. Exactly one scene per project; `stage.scene` always exists after load (FR-001).
2. `parentId`/`children` consistent; no cycles; reparenting keeps the world matrix (FR-033): `local = inverse(parentWorld_new) × world`.
3. A fixture id appears in at most one `fixtureVisualization` object; duplicate/paste sets `fixtureId = null` (FR-034).
4. Deleting an object deletes its descendants (one history entry). Deleting a `fixtureVisualization` object never deletes the fixture (FR-035).
5. Deleting a fixture removes its visualization object (outside history). Applying a history entry that contains an object linked to a missing fixture sets its `fixtureId` to `null`.
6. Scale ≥ 0.01 per axis; dimensions ≥ 0.01 m; all numbers finite. Inspector input outside the range is clamped.
7. Load is tolerant: an object with a missing parent becomes a root object; an `importedModel` with a missing or corrupt asset renders as a placeholder (FR-061); invalid numbers are replaced by defaults. Problems are reported in one toast, never thrown.

## State transitions

### Object lifecycle

```text
          add / paste / duplicate / import
(none) ───────────────────────────────────► present ──delete──► (none)
                                              │  ▲
                         edit (transform, rename, props, reparent,
                         hide/lock, align/distribute) as history entries
                                              │  │
                                         undo │  │ redo
```

### Transform drag

```text
idle ──pointerdown on handle──► dragging (store "preview" writes, no history)
dragging ──pointerup──► idle (+1 history entry with before/after)
dragging ──Escape or undo──► idle (restore before-states, no entry)
```

### Fixture link

```text
unlinked ──assign fixture (inspector)──► linked
linked ──duplicate/paste copy──► copy is unlinked
linked ──fixture deleted──► object removed
linked ──change visualization type──► linked (new default config, same id/name/transform/parent)
```

## Persistence

`StageState` changes from `{ fixtures, controllers, visualization }` to `{ fixtures, controllers, scene }`. Stage export/import and project save/load both include the full scene with assets (FR-001, SC-003). Old files with `visualization` are converted once on load (see research R11).
