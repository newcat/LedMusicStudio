# Contract: Rendering UI (mapping editor, environment, display settings, strip drawing, HUD)

**Feature**: 003-rendering-capabilities | **Plan**: [plan.md](../plan.md) | Extends [001 editor-ui.md](../../001-scene-editor/contracts/editor-ui.md) and [002 library-ui.md](../../002-asset-library/contracts/library-ui.md)

This contract covers what the user sees and does. Data rules are in [data-model.md](../data-model.md).

## Editor toolbar additions

```text
… [Grid][Axes][Labels] | [View ▾][Focus][Cameras ▾] | [☁ Environment ▾][🖥 Display ▾] | [〰 Draw LED strip]
```

### Environment popover (project data, undoable; FR-020, FR-060)

| Control | Behavior |
|---|---|
| Haze | Slider 0–100 % plus a number field. Changes apply live in all views. One undo step per drag ("Set haze", coalesced). |
| Hazers raise haze | Checkbox (`hazerCoupling`). Hint: "Active fog/haze fixtures increase the haze while they run." |
| Ambient – editor | Select Dark / House lights / Daylight, plus a brightness slider 0–200 %. |
| Ambient – show window | Same controls, separate values. |

### Display popover (user preferences, not in the project; FR-050, FR-052, FR-061)

| Control | Behavior |
|---|---|
| Editor quality | Low / Medium / High (default Medium). Applies immediately. |
| Show window quality | Low / Medium / High. Applies to open show windows immediately (via `storage` event). |
| Show frame rate | Checkbox per view (editor / show window). |
| Limit flash rate | Checkbox, default on. Hint: "Limits strobes and flashes to 3 per second (photosensitivity)." |
| Show true strobe rate | Checkbox, only enabled while the limit is off. |

## Show window additions

- A **gear button** next to the camera menu (same auto-hide). It opens a small panel with the show window's quality, its FPS overlay toggle, and the two flash-rate checkboxes. These are the same preferences as in the Display popover.
- The **HUD** (below) in the top-left corner.

## HUD (both views; FR-052, FR-055)

- With "Show frame rate" on: `60 fps · 16.6 ms` in the top-left corner (monospace, semi-transparent background), updated every 500 ms.
- **Fallback notice**: shown once per view and feature, auto-hides after 8 s, can also be closed. Example: "Shadows are not supported on this device; a simpler version is used."

## Inspector: fixture visualization

The 002 inspector (linked fixture, type, model, model size) gets one section per type. Every section of a DMX type contains the **Capability mapping** editor.

### Capability mapping editor (`CapabilityMappingEditor.vue`, FR-011)

```text
┌ Capability mapping ───────────────────────── [Auto-Assign] ┐
│ ⚠ Fixture mode changed – mapping may be outdated           │  (only if mappedMode ≠ the fixture's mode)
│ Position                                                   │
│   Pan        [ 1: Pan        ▾] fine [ 2: Pan fine ▾]  −270° … 270°   auto │
│   Tilt       [ 3: Tilt       ▾] fine [ 4: Tilt fine▾]  −135° … 135°   auto │
│ Intensity                                                  │
│   Dimmer     [ 6: Dimmer     ▾]                         0 … 100 %  auto │
│   Shutter    [ 7: Shutter    ▾]  4 ranges ▸                         auto │
│ Color                                                      │
│   Red/Green/Blue/White …                                   │
│   Color wheel [ 5: Color Wheel ▾] 9 slots ▸  ● ● ● ● ◐ …   auto │
│ Beam                                                       │
│   Zoom / Gobo wheel / Gobo rotation / Prism …              │
│ Cells (12)  ▸                                              │
│ Unmapped channels: 9: Macro, 10: Reset                     │
└────────────────────────────────────────────────────────────┘
```

| Element | Behavior |
|---|---|
| Groups | Position, Intensity, Color, Beam, Effect, Cells. Only the keys of the visualization type are shown (data-model.md, `KEYS_BY_TYPE`). |
| Channel select | "— not mapped —" plus every channel of the current mode, shown as `<index+1>: <name>`. Changing it sets `source: "manual"`. |
| Fine select | Only for pan, tilt, dimmer, zoom. Lists the channels after the coarse one. |
| Range (linear keys) | Two number fields (start/end in the key's unit). Editing sets `source: "manual"`. If the key is unmapped, a "Default" field is shown instead. |
| Segments ▸ | Expands a table: from, to, kind (select), and the values of that kind. Rows can be added, removed and edited. Used for shutter, wheels, rotations, color macros and laser patterns. |
| Wheel preview | Color slots as swatches (split = two halves), gobo slots as 24 px thumbnails. Hovering shows the slot name. |
| Source badge | `auto` (grey) or `manual` (blue) per key. |
| Auto-Assign | Regenerates the whole mapping from the fixture definition and mode. Before overwriting manual entries it asks "Replace N manual mappings?" (a PrimeVue ConfirmPopup, not a browser dialog). One undo step. |
| Unmapped channels | Lists the channels of the mode that no key or cell uses (US2.2). |
| Cells ▸ | A table with emitter, pixel key and the R/G/B/W/A/UV/dimmer channel selects. Hint if the pixel count ≠ the model's cell count: "12 pixels are spread over 8 model cells." |

### Beam types (Spot, Moving Head)

| Control | Behavior |
|---|---|
| Movement | "Realistic" (default) / "Instant", plus pan and tilt speed (°/s), shown only for Realistic. Only shown if the model has moving parts. |
| Default beam angle | Shown when zoom is unmapped. |
| Edge softness | Slider (hard ↔ soft). |
| Prism spread | Number field (°), shown when the prism is mapped. |

### Generic Fixture

| Control | Behavior |
|---|---|
| Light surfaces | Checkbox, plus a light angle field when checked. |

### LED strip

| Control | Behavior |
|---|---|
| Path | "Draw path" (starts the drawing tool for this strip) and "Edit path" (toggles point handles). Shows the point count and length ("6 points · 4.82 m"). |
| Interpolation | Straight segments / Smooth curve. |
| Closed loop | Checkbox. |
| Pixel size | Slider (relative to the LED pitch). |
| Intensity | As before. |

The pixel count is read-only and taken from the linked fixture ("300 pixels, 62 per meter").

### Effect types (Laser, Flame, CO2 Jet, Cold Spark, Fog / Haze)

The capability mapping editor (Effect group), plus the effect options (data-model.md, `EffectVisualizationConfig.options`). If `trigger` / `fogOutput` is unmapped: notice "No trigger channel mapped – the effect stays off."

## LED strip drawing tool (FR-031, research R17)

| Step | Behavior |
|---|---|
| Start | Toolbar "Draw LED strip": creates an unlinked LED strip visualization (named "LED strip N") and enters draw mode. Inspector "Draw path": enters draw mode for the selected strip (its path is replaced on finish). Cursor: crosshair. Status hint: "Click to add points · Shift: straight · Backspace: undo point · Enter/double-click: finish · Esc: cancel". |
| Click on a surface | Adds a point at the hit position, offset 5 mm along the surface normal, and stores the normal. Clicks into empty space use the floor plane y = 0 (normal +Y). |
| Move | A ghost segment from the last point to the cursor shows the strip (and the curve, if smooth). |
| Shift | Locks the segment to the closest world axis. |
| Finish | Needs ≥ 2 points, otherwise Esc behavior. Commits one undo step ("Draw LED strip"), selects the strip and leaves draw mode. |
| Esc | Cancels. A newly created strip is removed, and an existing strip keeps its old path. |
| Edit path | Point handles (yellow spheres) and segment midpoint handles (small, grey). Dragging a point slides it along surfaces (preview/commit, one undo step per drag). Clicking a midpoint inserts a point. Delete/Backspace removes the selected point (min 2). Esc or clicking empty space leaves edit mode. |

Transform gizmos are hidden while drawing or editing a path.

## Messages

| When | Severity | Text |
|---|---|---|
| Auto-Assign could not map anything | warn | "No supported capabilities found in this fixture mode." |
| Fixture has no definition or mode | info (inline) | "Select a fixture and mode in the fixture settings to map channels." |
| Device fallback | HUD notice | see above |
| Gobo image could not be loaded | console warning only | — (the generic pattern is shown) |
