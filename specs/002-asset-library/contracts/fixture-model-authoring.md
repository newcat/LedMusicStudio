# Contract: Authoring Library Assets

**Feature**: 002-asset-library | **Plan**: [plan.md](../plan.md) | Types: [asset-catalog.ts](./asset-catalog.ts)

These are the rules for adding an asset to the built-in library. If an asset follows them and the asset workbench shows it green, it works without code changes outside its own definition (SC-006).

## 1. Coordinates and size

- Meters, +Y up, the front faces **+Z**.
- The **base point** is the local origin. The lowest point of the geometry is at y = 0, and the asset is centered horizontally on the origin. (Parametric stage elements may anchor at a documented point instead: `stage.truss-corner` at its corner block, `stage.stairs` at the end of its top step; see data-model.md → "Parametric element parameters".)
- Real-world size. `defaultSize` must match the built bounding box within ±15 %.

## 2. Fixture models

- **Rest pose**: standing on its base or bracket, pan = tilt = 0, beam pointing **up (+Y)**. Hanging is done by the editor (flip 180° about X).
- **Moving parts**: give each moving part its own node, with the node's **origin at the pivot** and the rotation about one principal axis of the node (`x`, `y` or `z`). The tilt node must be a descendant of the pan node. Typical names: `pan`/`yoke` and `tilt`/`head`. Any name works, because the description refers to it.
- **Beam**: `beam.node` is the node the beam moves with (the tilt node for moving heads, `""` for static fixtures). `position` is the lens center and `direction` a unit vector, both in that node's frame. `lensRadius` is the radius of the visible lens.
- **Emitters**: one entry per individually controllable light surface (lens, LED cell, laser aperture, flame nozzle). Use the ids `lens`, `cell-<n>` (linear) or `cell-<row>-<col>` (matrix, row 1 at the top), `aperture` or `nozzle`. Place the emitter a little (≈1 mm) in front of the surface it covers to avoid z-fighting. Do **not** model glowing materials into the mesh: the renderer creates the emitter surfaces.
- **Mounting points**: at least one. For base-plate fixtures use the base center with `direction [0, -1, 0]`. Bar-shaped fixtures (LED bar, pixel bar, blinder, strobe) use their bracket.
- **Visualization types**: list only the types whose role requirements the model meets (data-model.md, "Role requirements"). If the model has emitter cells, include "Generic Fixture".
- **Physical limits**: `movingParts.*.min/max` are the real pan and tilt ranges (for example pan −270…270, tilt −135…135).

## 3. Procedural builders (default)

- File: `src/assetLibrary/builders/<category>/<name>.ts`, exporting a `build(kit)` (or `build(params, kit)` for parametric elements).
- Use only `BuilderKit` primitives and Three.js geometry. No textures. Give every mesh a **slot** (`body`, `accent`, `metal`, `brass`, `fabric`, `glass`, `screen`).
- Finish with `kit.mergeBySlot(root, [names of moving-part nodes])`, so static parts become at most one mesh per slot (performance, research R6).
- Poly budget: decoration ≤ 3 000 triangles, fixtures ≤ 5 000, and parametric elements ≤ 20 000 at their maximum parameters. Cylinders use 12–24 segments.
- Deterministic: the same parameters always give the same geometry (no randomness).
- Parametric elements: `size(params)` must be pure and must match the build (±2 %). Repeating structures repeat with a nominal module length (research R5) and are never stretched.

## 4. GLB files (exception)

- Only with a license from the allow-list (CC0-1.0, CC-BY-4.0, Apache-2.0, MIT; GPL-3.0-or-later if made for the project). Record author, source URL and license in `credits`. For Apache-2.0 files, add the license text under `public/asset-library/LICENSES/`.
- Export: glTF binary, +Y up, meters, apply transforms, no cameras or lights, at most 2 textures of ≤ 1024 px, file size ≤ 1 MB (SC-007 budget).
- Node names of moving parts must survive export (check them in the workbench). Use the material names as slot names if the asset offers variants.
- Location: `public/asset-library/models/<id-without-prefix>.glb`.

## 5. Definition entry

- Add the entry to the category file in `src/assetLibrary/catalog/` with a new, never-used id (`<category-prefix>.<kebab-name>`), a name, at least 3 keywords (including common synonyms, e.g. "PA", "loudspeaker", "box"), `defaultSize`, credits, source, and the variants or slots if it has any.

## 6. Done checklist (asset workbench, `pnpm dev` → `/asset-workbench.html`)

1. The asset shows **no validation errors**.
2. The contract overlay looks right: pivots on the hinge, the beam starts in the lens and points where the head points during the pan/tilt sweep, emitters cover their surfaces, mounting and connection points sit on the clamp or tube ends.
3. For parametric elements: the min, default and max builds look undistorted.
4. Preview rendered and saved to `public/asset-library/previews/<id>.webp`.
5. The asset appears in the credits dialog with complete data.
