import * as THREE from "three";

import type { QualityProfile } from "../quality";

/**
 * Light prioritization (feature 003, FR-023, research R7, data-model §6 "Light tier"). Each frame every light gets
 * a score; the best `fullLights` keep gobo, prism and shadow, the next `simpleLights` are plain cones, and the rest
 * are summed into an ambient tint. A 15 % hysteresis keeps lights from flickering between tiers.
 */

export type LightTier = "full" | "simple" | "overflow";

export interface PrioritizedLight<K = number> {
    /** Stable key, e.g. the light handle; used to look up the previous tier. */
    readonly key: K;
    /** Linear RGB × intensity. */
    readonly color: { readonly r: number; readonly g: number; readonly b: number };
    /** Full beam angle in degrees (omni lights use OMNI_ANGLE). */
    readonly angle: number;
    /** World point the light mainly lights: the beam center hit point, or the omni position. */
    readonly litPoint: THREE.Vector3;
    /** Written by assignTiers. */
    score: number;
}

/** Angle used for the coverage of omni lights. */
export const OMNI_ANGLE = 120;
/** "A light changes tier only if its score beats the boundary by 15 %." */
export const TIER_HYSTERESIS = 1.15;
/** Visibility factor of lights whose lit point is outside the camera frustum. */
const OFFSCREEN_VISIBILITY = 0.25;

const TIER_RANK: Record<LightTier, number> = { full: 0, simple: 1, overflow: 2 };

const frustum = new THREE.Frustum();
const projScreen = new THREE.Matrix4();

export function luminance(color: { r: number; g: number; b: number }): number {
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/**
 * Scores the lights (`score = luminance(color) · (0.5 + angle/120) · visibility`) and assigns their tiers. Ranks
 * < `fullLights` → full, < `fullLights + simpleLights` → simple, the rest → overflow.
 *
 * Hysteresis: for the ranking, a light's score is raised by 15 % for each tier it already holds above overflow
 * (from `previous`). A light therefore only moves into a better tier when its score beats the light at that tier's
 * boundary by 15 %, and a light only drops out when another one beats it by 15 %. Tier capacities are never exceeded.
 *
 * `lights` is sorted in place, best first (by the hysteresis score). Returns the tier of every light.
 */
export function assignTiers<K>(
    lights: Array<PrioritizedLight<K>>,
    camera: THREE.Camera,
    quality: QualityProfile,
    previous: ReadonlyMap<K, LightTier>,
): Map<K, LightTier> {
    camera.updateMatrixWorld();
    projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreen);

    const ranking = new Map<K, number>();
    for (const light of lights) {
        const visibility = frustum.containsPoint(light.litPoint) ? 1 : OFFSCREEN_VISIBILITY;
        light.score = luminance(light.color) * (0.5 + Math.max(0, light.angle) / 120) * visibility;
        const prev = previous.get(light.key);
        const held = prev === undefined ? 0 : 2 - TIER_RANK[prev];
        ranking.set(light.key, light.score * Math.pow(TIER_HYSTERESIS, held));
    }
    lights.sort((a, b) => ranking.get(b.key)! - ranking.get(a.key)!);

    const tiers = new Map<K, LightTier>();
    const full = Math.max(0, quality.fullLights);
    const simple = full + Math.max(0, quality.simpleLights);
    lights.forEach((light, rank) => {
        tiers.set(light.key, rank < full ? "full" : rank < simple ? "simple" : "overflow");
    });
    return tiers;
}
