/**
 * Shared static U-bracket of the standing fixture models (feature 002, phase 5): a floor strap along X with two
 * side arms up to the pivot and a clamp knob on the outside of each arm. The bracket is centered on the origin and
 * stands on y = 0; its mounting point is the strap center.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

export interface UBracketLayout {
    /** Distance of the arm centers from the origin along X. */
    armX: number;
    /** Height of the pivot (knob axis) above the floor. */
    pivotY: number;
    /** Strap and arm width along Z. */
    width?: number;
    /** Strap and arm thickness. */
    thickness?: number;
    /** Length of the two feet along Z; 0 = no feet. */
    feet?: number;
    /** Knob radius. */
    knob?: number;
}

/** Adds the bracket meshes to `root` (all slot `metal`) and returns the outer X extent including the knobs. */
export function addUBracket(kit: BuilderKit, root: THREE.Object3D, layout: UBracketLayout): number {
    const width = layout.width ?? 0.04;
    const thickness = layout.thickness ?? 0.008;
    const knob = layout.knob ?? 0.016;
    const strap = kit.box([layout.armX * 2 + thickness, thickness, width], "metal");
    root.add(strap);
    for (const side of [-1, 1]) {
        const x = side * layout.armX;
        const arm = kit.box([thickness, layout.pivotY + width / 2, width], "metal");
        arm.position.x = x;
        root.add(arm);
        if (layout.feet) {
            const foot = kit.box([0.03, thickness, layout.feet], "metal", { bevel: 0.005 });
            foot.position.x = x;
            root.add(foot);
        }
        const outer = x + (side * thickness) / 2;
        root.add(kit.tube([outer, layout.pivotY, 0], [outer + side * 0.01, layout.pivotY, 0], knob, "accent"));
    }
    return layout.armX + thickness / 2 + 0.01;
}
