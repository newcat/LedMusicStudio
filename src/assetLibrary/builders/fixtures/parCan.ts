/**
 * fixture.par-can: a classic par can (feature 002, T041). A static U-bracket standing on its feet holds the can
 * (radius 0.11 m, length 0.28 m), which points up (+Y) with the lens at y = 0.35 m. No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

export const PAR_LENS_Y = 0.35;
const CAN_BOTTOM = PAR_LENS_Y - 0.28;
const CAN_RADIUS = 0.11;
const PIVOT_Y = (CAN_BOTTOM + PAR_LENS_Y) / 2;
const ARM_X = 0.118;

export function buildParCan(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("par-can");

    // bracket: two feet along Z, a floor bar along X and two arms up to the pivot
    for (const side of [-1, 1]) {
        const foot = kit.box([0.03, 0.012, 0.24], "metal", { bevel: 0.005 });
        foot.position.x = side * ARM_X;
        root.add(foot);
        const arm = kit.box([0.01, PIVOT_Y + 0.02, 0.04], "metal");
        arm.position.x = side * ARM_X;
        root.add(arm);
        // clamp knob on the outside of the arm
        root.add(kit.tube([side * (ARM_X + 0.005), PIVOT_Y, 0], [side * (ARM_X + 0.012), PIVOT_Y, 0], 0.016, "metal"));
    }
    const bar = kit.box([ARM_X * 2, 0.012, 0.04], "metal");
    root.add(bar);

    // can with a closed, rounded back
    root.add(
        kit.lathe(
            [
                [0, CAN_BOTTOM],
                [0.06, CAN_BOTTOM],
                [0.095, CAN_BOTTOM + 0.015],
                [CAN_RADIUS, CAN_BOTTOM + 0.05],
                [CAN_RADIUS, PAR_LENS_Y - 0.015],
                [0, PAR_LENS_Y - 0.015],
            ],
            "body",
        ),
    );
    // front rim and lens
    root.add(
        kit.lathe(
            [
                [0.09, PAR_LENS_Y - 0.015],
                [CAN_RADIUS + 0.002, PAR_LENS_Y - 0.015],
                [CAN_RADIUS + 0.002, PAR_LENS_Y],
                [0.09, PAR_LENS_Y],
                [0.09, PAR_LENS_Y - 0.015],
            ],
            "metal",
        ),
    );
    const glass = kit.cylinder(0.09, 0.09, 0.002, "glass", 24);
    glass.position.y = PAR_LENS_Y - 0.004;
    root.add(glass);

    return kit.mergeBySlot(root);
}
