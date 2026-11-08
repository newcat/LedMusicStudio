# Quickstart & Validation: Asset Library & Model Contract

**Feature**: 002-asset-library | **Plan**: [plan.md](./plan.md)

How to run the app and check that the feature works from end to end. The full step list is the spec's [Manual Verification](./spec.md#manual-verification-required-by-constitution-principle-iii) section; this guide adds setup, test data and the mapping to requirements. UI details: [contracts/library-ui.md](./contracts/library-ui.md). Data rules: [data-model.md](./data-model.md). Asset rules: [contracts/fixture-model-authoring.md](./contracts/fixture-model-authoring.md).

## Prerequisites

- Node + pnpm (`packageManager` in `package.json`), `pnpm install`; WASM built once (`pnpm build:wasm`) if not present.
- Feature 001 is in place (scene editor in Stage → Visualization).
- Test data:
  - a project saved **before** this feature with a moving head, a spot (aimed at a known point) and an LED strip visualization;
  - OFL fixtures picked from the fixture library: a moving head with `physical.dimensions` (most OFL moving heads have them), a par/color changer, a pixel bar, a strobe, a laser, a hazer, and a fixture without dimensions;
  - a copy of a saved project in which one `libraryAsset.assetId` has been edited to `decoration.does-not-exist` and one `modelId` to `fixture.does-not-exist`.

## Quality gates (before committing to `main`)

```powershell
pnpm lint
pnpm build            # vue-tsc --noEmit + browser build (what CI deploys)
```

Both must pass (constitution II). The workbench page must **not** appear in `dist/` (it is dev-only).

## Asset gate (before committing any asset change)

1. `pnpm dev`, open http://localhost:3000/asset-workbench.html.
2. Expected: the summary line reads "<N> assets, 0 errors". Every asset row is green (research R10).
3. Click through the fixtures: the contract overlay shows pivots, beam origin and direction, emitters and mounting points in the right places. "Sweep" moves pan and tilt, and the beam stays in the lens.
4. Parametric elements: the "min / default / max" toggle shows undistorted builds.
5. "Render previews" → unpack the ZIP into `public/asset-library/previews/`. The workbench then reports no missing previews.

## Run

| Target | Command | Notes |
|---|---|---|
| Browser | `pnpm dev`, open http://localhost:3000 | The show window via "Open Visualizer" loads the library assets itself. |
| Desktop | `pnpm electron:dev` | Checks that the relative `asset-library/…` fetches work under Electron. |
| Browser production build | `pnpm build` then `pnpm serve` | Checks the deployed base path for GLBs and previews. |

## Validation scenarios

Run each in **both** targets.

| # | Scenario | Expected | Covers |
|---|---|---|---|
| 1 | Open Stage → Visualization. Look at the library panel; search "truss", "speaker", "laser", "pa box", "xyz". | Four sections with previews; each search shows only matching tiles; "xyz" shows the empty message. | US1, FR-002, FR-006 |
| 2 | Drag one asset per category onto the floor, one onto the top of a box shape, and one into empty sky. | Each stands on the surface under the pointer (in empty sky: on the floor), upright, selected; a table is ~0.75 m high, a speaker stack ~1.8 m (check in the inspector or against a 1 m box). | US1, FR-003, FR-004 |
| 3 | Double-click a tile; press Esc during a drag. | Added at the viewport center; Esc cancels without creating an object. | FR-003 |
| 4 | Create a DMX moving head (with dimensions) → add its visualization. | Type Moving Head and a moving head model are preselected; the model size is ≠ 100 % with the "Scaled to fixture dimensions" hint; "Reset to model size" → 100 %. | US2, FR-014, FR-015 |
| 5 | Map pan, tilt and RGB, run a pan/tilt sweep (DMX panel or a timeline), then switch the model through all moving head models. | For every model the head moves, the beam starts in the lens and follows the head; position, rotation, parent, link and mapping do not change. | US2, FR-011, FR-013, SC-005 |
| 6 | Create the fixtures listed under test data, add visualizations, map intensity and color, raise them from 0 to full. | Preselected types/models match research R13; the fixture without dimensions keeps 100 %; generic fixtures glow from off to full in the mapped color (white without color mapping); LED bar/pixel bar/blinder/panel cells glow together. | US3, FR-020, FR-022, FR-023 |
| 7 | Add a spot visualization. | It has a visible par can body with the beam leaving the lens; it can be picked by clicking the body. | US2-6, FR-021 |
| 8 | Build a 6 × 4 × 1 m platform with stairs, a 6 m straight truss with two towers and a corner, and a backdrop. Change the platform height to 1.4 m, the truss length 2 → 5 m, the stairs height 0.6 → 1.4 m. Try 0 m and 200 m. | No distortion; more truss bays and more steps instead of stretching; values are clamped to the shown ranges. | US4, FR-031, FR-032 |
| 9 | Drag 4 moving heads under the truss; drag a truss segment next to another; repeat while holding Ctrl. Then move the truss. | Fixtures hang upside down on the chord and are children of the truss in the outliner; segments connect end to end exactly; with Ctrl both are placed freely; the fixtures follow the truss. | US5, FR-040–043 |
| 10 | Delete the truss with mounted fixtures, then undo. | Truss and visualizations are gone (the DMX fixtures stay in Stage → Fixtures); undo restores everything. | Edge case |
| 11 | Place each decoration asset; change the color variant of the speaker stack and the DJ booth. | All FR-030 items are present; the variant changes the appearance. | US6, FR-030, FR-033 |
| 12 | Put 7 boxes under one moving head beam and give each a different material preset; change the color of one. | Clearly different surfaces (shiny metal and plastic vs. matte fabric and concrete); the color change keeps the surface type. | US7, FR-050 |
| 13 | Library ⋮ → Asset credits. | Every asset is listed with author, source and license; project-made assets have the badge. | US8, FR-061, SC-008 |
| 14 | Save, reload, export the stage, import it into a new project. Open the project JSON in an editor. | The scene is identical; the JSON contains asset ids and params but no geometry or base64 for library assets. | FR-005, US1-5, US4-4 |
| 15 | Load the edited copy with unknown ids. | One warning toast each; a red placeholder of the stored size at the right place; "Replace asset…" swaps it and keeps transform and children; the unknown fixture model shows the generic body. | FR-070, edge cases |
| 16 | Load the old (pre-002) project. | The moving head uses the procedural spot model at the same place and aim; the spot now has a body and still aims at the same point; the LED strip has a profile body. | R3, FR-021 |
| 17 | Open the show window during scenarios 2, 8 and 9. | It shows the same assets, parameters, materials and mounted fixtures within a frame or two. | R15 |
| 18 | Performance: build the SC-004 scene (300 objects, 60 fixture visualizations, 100 copies of the chair), orbit and play a show. | Smooth on the reference machine (001 R15); note fps in the PR. | SC-004, FR-071 |
| 19 | Compare the size of `dist/` with the previous release build. | Growth ≤ 25 MB. | SC-007 |
| 20 | Time yourself building the SC-003 club stage. | < 10 minutes; any asset is found and placed in < 15 s. | SC-002, SC-003 |
