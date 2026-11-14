/**
 * fixture.moving-head-spot: a spot/beam moving head (feature 002, T038). Standing, beam along +Y at rest.
 * Base 0.35 × 0.14 × 0.3 m, `pan` on top of the base, `tilt` between the arm tops at y = 0.38 m,
 * head 0.36 m long (−0.12 … 0.24 relative to `tilt`) with the lens at its +Y end.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";
import { buildMovingHeadFrame, type MovingHeadLayout } from "./movingHeadCommon";

export const MOVING_HEAD_SPOT_LENS_Y = 0.24;

export const MOVING_HEAD_SPOT_LAYOUT: MovingHeadLayout = {
    base: [0.35, 0.14, 0.3],
    armX: 0.15,
    arm: [0.04, 0.3, 0.12],
    tiltHeight: 0.24,
};

export function buildMovingHeadSpot(kit: BuilderKit): THREE.Object3D {
    const { root, tilt } = buildMovingHeadFrame(kit, "moving-head-spot", MOVING_HEAD_SPOT_LAYOUT);

    // head: rounded back, cylindrical middle, slightly narrower front
    tilt.add(
        kit.lathe(
            [
                [0, -0.12],
                [0.06, -0.12],
                [0.095, -0.1],
                [0.11, -0.06],
                [0.11, 0.12],
                [0.1, 0.2],
                [0.085, 0.228],
                [0, 0.228],
            ],
            "body",
        ),
    );
    // cooling fins on the back half
    for (const y of [-0.05, -0.02, 0.01]) {
        const fin = kit.cylinder(0.112, 0.112, 0.008, "accent", 24);
        fin.position.y = y;
        tilt.add(fin);
    }
    // front lens ring and glass, flush with the lens plane
    tilt.add(
        kit.lathe(
            [
                [0.062, 0.226],
                [0.088, 0.226],
                [0.088, MOVING_HEAD_SPOT_LENS_Y],
                [0.062, MOVING_HEAD_SPOT_LENS_Y],
                [0.062, 0.226],
            ],
            "accent",
        ),
    );
    const glass = kit.cylinder(0.062, 0.062, 0.004, "glass", 24);
    glass.position.y = MOVING_HEAD_SPOT_LENS_Y - 0.0045;
    tilt.add(glass);

    return kit.mergeBySlot(root, ["pan", "tilt"]);
}
