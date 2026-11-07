# Quickstart & Validation: Scene Model & 3D Scene Editor

**Feature**: 001-scene-editor | **Plan**: [plan.md](./plan.md)

How to run the app and check that the feature works from end to end. The full step list is the spec's [Manual Verification](./spec.md#manual-verification-required-by-constitution-principle-iii) section; this guide adds setup, test data and the mapping to requirements. Interaction details: [contracts/editor-ui.md](./contracts/editor-ui.md). Data rules: [data-model.md](./data-model.md).

## Prerequisites

- Node + pnpm (version from `package.json` `packageManager`), dependencies installed: `pnpm install`.
- WASM built once if not already present: `pnpm build:wasm`.
- Test files:
  - a textured GLB model (e.g. a Khronos glTF sample such as "DamagedHelmet.glb", or `public/3d-models/moving_head_lowpoly.glb`);
  - an invalid file renamed to `.glb` (e.g. a text file);
  - a project file saved **before** this feature that has fixture visualizations (moving head, spot, LED strip) and a loaded static scene.
- A second monitor is helpful for the show window but not required.

## Quality gates (before committing to `main`)

```powershell
pnpm lint
pnpm build            # vue-tsc --noEmit + browser build (what CI deploys)
```

Both must pass (constitution II).

## Run

| Target | Command | Notes |
|---|---|---|
| Browser | `pnpm dev`, open http://localhost:3000 | Show window opens as a new tab/window via "Open Visualizer". |
| Desktop | `pnpm electron:dev` | Same flows; file dialogs are native. |
| Browser production build | `pnpm build` then `pnpm serve` | Checks the deployed variant, incl. `visualization.html` entry. |

## Validation scenarios

Run each in **both** targets. Expected results in short; full wording in the spec.

| # | Scenario | Expected | Covers |
|---|---|---|---|
| 1 | New project → Stage → Visualization. Orbit, pan, zoom; keys 1/3/7/5; select floor, press F. | Floor + grid + axes gizmo, no "No scene loaded"; views switch; focus frames the floor. | US1, FR-002, FR-010–013 |
| 2 | Add box, cylinder, plane, sphere. Resize/recolor/rename in inspector; move/rotate/scale with handles; Shift+S with 0.25 m / 15°; hold Ctrl while dragging. | Immediate updates, no Apply button; values snap; Ctrl inverts snapping. | US2, US3, FR-022–024, FR-030 |
| 3 | Create a DMX fixture (moving head visualization) and an LED strip fixture (LED strip visualization), once via Add → Fixture visualization and once via fixture settings. Place by mouse, drag strip endpoint handles, play a timeline item driving both, orbit during playback. | Moving head pans/tilts/colors; strip lights nearby surfaces of shapes in their own colors; beams correct from all angles. | US1 #5, US2 #6, FR-014, FR-027, FR-031 |
| 4 | Click a fixture's object → "Open fixture settings"; select another fixture in the Fixtures tab and return to Visualization. | Tab switches to that fixture; the other fixture's object is selected in 3D. | FR-025, FR-026 |
| 5 | Group "Truss", drag three fixture objects onto it in the outliner, move and rotate the group; undo/redo the last 5 actions; start a drag and press Ctrl+Z mid-drag. | Fixtures keep world position on attach and follow the group; each undo/redo step exact; mid-drag undo returns to pre-drag state. | US4 #2, #7, FR-033, FR-040 |
| 6 | Multi-select with Ctrl+click and move; duplicate (Ctrl+D), copy/paste; hide (H) and lock; try to click the locked object; delete a fixture visualization object; delete a fixture in the Fixtures tab. | Group moves together; copies offset and unlinked; hidden object gone in editor and show window; locked object not pickable in 3D but in outliner; fixture survives deleting its object; deleting the fixture removes its object. | US4, FR-034, FR-035 |
| 7 | Select 8 fixtures in a rough line; Align Y to active; Distribute X. | Same height; equal spacing between the outermost ones. | US8, FR-036 |
| 8 | Import the textured GLB; import the invalid file; import a model > 20 MB (if available). | Textures preserved; error toast, scene unchanged; size warning and auto-scale toast. | US7, FR-037, edge cases |
| 9 | Save two camera positions, mark one as show default; "Open Visualizer"; move an object in the editor; orbit and switch cameras in the show window; open a second show window. | Show window starts at the default, no grid/handles/highlights/labels, follows edits within 0.5 s, own camera; second window shows the same state. | US5, US6, FR-050–053 |
| 10 | Save, close and reopen the project; export the stage and import into a new project; reload on another machine/browser if possible. | Everything from 2–9 restored identically, imported model without the original file. | FR-001, SC-003 |
| 11 | Load the pre-feature project file. | Loads without error; default floor; one-time notice; moving head/spot/LED strip placements kept as far as convertible. | FR-007, edge case, research R11 |
| 12 | Open/close the show window 10×; switch away from and back to the Visualization tab 10×; load another project 10×. Watch frame rate and (browser DevTools → Memory / Performance) WebGL context count. | No slowdown, no "Too many active WebGL contexts" warning, no old scene visible. | FR-062, SC-006 |
| 13 | Performance: build a scene with 200 objects incl. 50 fixture visualizations (duplicate + assign), orbit and drag. Record machine, browser/Electron version and observed fps. | No visible stutter; if real spotlight count is the bottleneck, see research R15 cap. | SC-004 |
| 14 | Type in an inspector field and press Delete / Ctrl+Z / W. | The text field edits; no editor shortcut fires. | FR-041 |

## Recording results

Note the target, date, reference machine and any deviation per scenario in the PR/commit description, and state that projects from before this feature lose their static scene (constitution IV).
