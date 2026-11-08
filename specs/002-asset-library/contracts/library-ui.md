# Contract: Library UI, Placement, Snapping and Credits

**Feature**: 002-asset-library | **Plan**: [plan.md](../plan.md) | Extends [001 editor-ui.md](../../001-scene-editor/contracts/editor-ui.md)

This contract covers what the user sees and does. Data rules are in [data-model.md](../data-model.md).

## Layout

The left column of the scene editor is split vertically (resizable):

```text
┌ Toolbar ─────────────────────────────────────────────────────────────────┐
├ Outliner ─────┬ Viewport ───────────────────────────────┬ Inspector ─────┤
│ (001)         │                                         │                │
├ Asset library ┤                                         │                │
│ [🔍 search  ] │                                         │                │
│ ▸ Fixtures    │                                         │                │
│ ▾ Stage       │                                         │                │
│  [img][img]   │                                         │                │
│  Platform …   │                                         │                │
│ ▸ Decoration  │                                         │                │
│ ▸ Basic shapes│                                         │                │
│        ⋮ Credits                                        │                │
└───────────────┴─────────────────────────────────────────┴────────────────┘
```

## Asset library panel (FR-002, FR-006)

| Element | Behavior |
|---|---|
| Search field | Filters as you type. Case-insensitive; every word must occur in the name, the category or a keyword. Esc clears it. While a search is active, sections with hits expand automatically and empty sections are hidden. Shows "No assets match "<query>"" if nothing matches. |
| Category sections | Fixtures, Stage, Decoration, Basic shapes, in this order. Collapsible; the open/closed state is kept for the session. |
| Tile | Preview (WebP, lazy loaded; category icon if it is missing) and name; the tooltip shows name and size ("1.80 m high"). |
| Drag tile → viewport | Places the asset (see below). |
| Double-click / Enter on tile | Adds the asset at the surface point in the center of the viewport (on the floor at the origin if nothing is hit), and selects it. |
| Header menu ⋮ → "Asset credits" | Opens the credits dialog. |

## Placement by drag & drop (FR-003, FR-004)

1. While dragging over the viewport, a semi-transparent **ghost** of the asset stands with its base point on the surface under the pointer. Over empty space it stands on the floor plane y = 0 where the ray meets it; if the ray misses the floor, at the origin. It stays upright (rotation 0), except when it snaps (below).
2. **Release** creates the object (one undo step "Add <asset name>"), selects it, and focuses the inspector on it.
3. Leaving the viewport or pressing Esc during the drag cancels it; no object is created.
4. Fixture models create an **unlinked fixture visualization** (type = the model's first compatible type). The inspector shows "Link fixture" (001).
5. Basic shapes behave exactly like the 001 "Add → Shape" menu, but at the drop point.

## Snapping (FR-040–043)

Active while dragging from the library **and** while moving a single selected fixture visualization or truss element with the translate gizmo. Holding **Ctrl** disables it.

| Situation | Result |
|---|---|
| Fixture within 0.3 m below a truss chord (`hang`) | Ghost flips upside down, its mounting point touches the underside of the chord, and it is aligned with the chord. On release it becomes a **child** of the truss. |
| Fixture within 0.3 m above a chord or a platform top (`stand`) | Ghost stands on it. On release it becomes a child of that object. |
| Truss element within 0.3 m of a free, compatible connection point | Ends line up exactly (position and orientation). Not reparented. |
| Several candidates | The nearest one wins. |

Feedback: the candidate area or connection point is highlighted (editor layer, accent color), and the status hint at the bottom of the viewport reads "Hang on <name>", "Stand on <name>" or "Connect to <name>".

## Inspector additions

### Library asset (`libraryAsset`)

| Field | Shown for | Behavior |
|---|---|---|
| Asset | all | Name and preview; button **Replace asset…** opens a picker filtered to the same category (any category for placeholders). Transform, parent and children are kept. |
| Parameters | parametric | One number field per parameter with its unit and range ("0.25 – 30 m"), clamped. Choice parameters as a select. Changing a field by dragging creates one undo step. |
| Material | `supportsMaterial` | Select: "None (color only)" + 7 presets. Choosing a preset also sets the color to the preset color. |
| Color | parametric, or assets with a `body` slot | Color picker; "Reset" sets it back to the asset default (`null`). |
| Variant | assets with variants | Select. |
| Placeholder notice | unknown `assetId` | "This asset is not available in this version (<id>)." plus **Replace asset…** |

### Shape (001 + material)

The Material select is added above Color, with the same behavior as above.

### Fixture visualization (001 + model)

| Field | Behavior |
|---|---|
| Model | Select of the models compatible with the visualization type, each with a small preview. Changing it keeps transform, parent, link, channel mapping and settings (FR-013). |
| Model size | Shows `modelScale` as a percentage; **Reset to model size** sets it to 100 %. Hint "Scaled to fixture dimensions" when it was set automatically. |
| Unknown model notice | "Model <id> is not available; showing the generic fixture." |

### Add fixture visualization dialog / fixture settings (FR-014)

When a fixture is chosen, the **visualization type** and the **model** are preselected by category mapping (research R13). The dialog gets a Model select under the type select. The type select in Fixture Settings also applies the mapped model.

## Asset credits dialog (FR-061, SC-008)

A modal list grouped by category: name, author, source (a link that opens externally through the native adapter or a normal link in the browser), license (SPDX id, linked to its text), and the badge "made for LEDMusic Studio" for project-made assets. At the top: "Built-in 3D assets and their licenses." Read-only.

## Messages

| When | Type | Text |
|---|---|---|
| Load: unknown asset ids | toast warn (once per load) | "<n> objects use assets that are not available and are shown as placeholders." |
| Load: unknown fixture model id | toast warn (once per load) | "<n> fixture visualizations use unknown models; the generic fixture is shown." |
| Asset GLB failed to load | toast error | "Asset "<name>" could not be loaded." (the object shows a placeholder) |
| Snap attached | none (visible in the outliner) | — |
