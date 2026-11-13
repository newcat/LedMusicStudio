/**
 * Render layers of a view (re-exported by `sceneView.ts`). Kept in their own module so that `src/assetLibrary/**`
 * (fixture bodies) can use them without importing the view.
 */

/** Objects that only exist for editing (grid, handles, proxies) are put on this layer. */
export const EDITOR_LAYER = 1;

/**
 * Objects that must not cast shadows in the shadow atlas (feature 003, research R11): beams, emitters, particles,
 * strip pixels. They are put on this layer only; the view camera enables it, the shadow cameras do not.
 */
export const NO_SHADOW_LAYER = 2;
