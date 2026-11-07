# Contract: Editor UI

**Feature**: 001-scene-editor | User-facing interaction contract of the embedded 3D editor (Stage → Visualization tab).

## Layout

```text
┌ Toolbar ─────────────────────────────────────────────────────────────────────┐
│ Add ▾ | Move Rotate Scale | World/Local | Snap ☐ 0.25m 15° | Grid Axes Labels │
│ View ▾ (Perspective/Top/Front/Side) | Focus | Cameras ▾ | Undo Redo           │
├ Outliner ──────┬ 3D viewport ─────────────────────────────┬ Inspector ────────┤
│ tree: name,    │ grid, axes gizmo (corner), handles,      │ name, kind        │
│ eye (hide),    │ selection boxes, labels                  │ position (m)      │
│ lock icons;    │                                          │ rotation (°)      │
│ drag & drop    │                                          │ scale             │
│ to reparent    │                                          │ kind properties   │
└────────────────┴──────────────────────────────────────────┴───────────────────┘
```

Panels use the existing `splitpanes` dependency so the outliner and inspector can be resized.

## Menus

- **Add**: Box, Cylinder, Plane, Sphere, Group, Fixture visualization… (dialog: choose fixture without visualization + compatible visualization type), Import model (GLB)….
  New objects are placed at the surface point under the last pointer position in the viewport (raycast against visible objects); without a hit, at the origin on the floor (y = 0). They become the only selected object (FR-030).
- **Selection context menu** (right click without drag on an object, or in the outliner): Duplicate, Copy, Paste, Delete, Hide/Show, Lock/Unlock, Focus, Unparent, Align ▸ X/Y/Z to active, Distribute ▸ X/Y/Z, Open fixture settings (fixture visualizations only).
- **Cameras**: list of saved positions (click = apply), "Save camera position…" (name prompt), per entry: rename, delete, "Use as show window default".

## Mouse

| Input | Action |
|---|---|
| Left click on object | Select only this object (locked/hidden objects are ignored) |
| Ctrl/Shift + left click | Toggle object in selection |
| Left click on empty space | Clear selection |
| Left drag (not on handle) | Orbit |
| Right drag, Shift + left drag, middle drag | Pan |
| Wheel | Zoom (towards pointer) |
| Drag handle | Move / rotate / scale; Ctrl held = invert snapping |
| Double click on object | Focus selection |

## Keyboard

Active when the viewport, outliner or toolbar has focus or the pointer is over the viewport; never while a text field, number field, select or contenteditable has focus (FR-041). Cmd replaces Ctrl on macOS.

| Key | Action |
|---|---|
| W / E / R | Move / rotate / scale mode |
| Q | Toggle world/local axes |
| Delete, Backspace | Delete selection (with descendants) |
| Ctrl+D | Duplicate (offset +0.25 m on X, selected afterwards) |
| Ctrl+C / Ctrl+V | Copy / paste |
| Ctrl+Z | Undo (cancels a running drag instead, if any) |
| Ctrl+Y, Ctrl+Shift+Z | Redo |
| Ctrl+A | Select all (pickable objects) |
| F | Focus selection |
| H | Toggle visibility of selection |
| Shift+S | Toggle snapping |
| 1 / 3 / 7 / 5 | Front / side / top / perspective view |
| Escape | Cancel drag; otherwise clear selection |
| F2 | Rename active object (outliner inline edit) |

## Inspector

- Values apply on every change (input event or spinner step), without an "Apply" button (FR-024). Typing a number commits one history entry when the field loses focus or Enter is pressed; spinner steps merge into one entry while the field keeps focus.
- Multi-selection: shows common fields; editing a field sets it on all selected objects (one history entry).
- **Shape**: shape type (read-only), dimensions (m), color picker.
- **Fixture visualization**: linked fixture (select; only fixtures without visualization of a compatible type, plus "None"), visualization type (select), type settings component (channel mapping etc., reused from `src/visualization/fixtureVisualizations/*Settings.vue` without placement fields), button "Open fixture settings" (switches to the Fixtures tab with that fixture selected, FR-025). LED strip: start/end (local, m) fields in addition to the handles.
- **Imported model**: file name, file size, "Restore original scale".
- **Group**: no extra fields.

## Cross-view selection (FR-026)

Selection lives in the scene store. Selecting a fixture in the Fixtures tab selects its visualization object; selecting a linked visualization object selects its fixture in the Fixtures tab. The Stage view's active tab is part of a small shared state so "Open fixture settings" can switch tabs.

## Messages

| Situation | Message |
|---|---|
| Invalid/unsupported model file | Error toast "Could not import model: <reason>"; scene unchanged |
| Model file > 20 MB | Confirm dialog "This model is <n> MB and will be stored in the project file, making it larger. Continue?" |
| Model auto-scaled | Info toast "Model was scaled to fit (factor <f>). Use 'Restore original scale' in the inspector to undo." |
| Old project format loaded | One-time info toast "This project was created with an older version. The static stage scene could not be converted and must be rebuilt; fixture visualizations were kept where possible." |
| Fixture already has a visualization | Error toast "<fixture> already has a visualization." |
| Load problems (missing parent, corrupt asset) | One warning toast summarizing the count; affected objects shown as placeholders |
