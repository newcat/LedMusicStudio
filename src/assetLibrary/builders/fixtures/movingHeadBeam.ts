/**
 * fixture.moving-head-beam: a slim beam moving head (feature 002, T039). Same node structure as the spot model:
 * base 0.3 × 0.12 × 0.25 m, `pan` on top of the base, `tilt` at y = 0.32 m, narrow cylindrical head
 * (radius 0.075 m, −0.1 … 0.18 relative to `tilt`) with a small lens at its +Y end.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";
import { buildMovingHeadFrame, type MovingHeadLayout } from "./movingHeadCommon";

const LENS_Y = 0.18;

export const MOVING_HEAD_BEAM_LAYOUT: MovingHeadLayout = {
    base: [0.3, 0.12, 0.25],
    armX: 0.105,
    arm: [0.035, 0.25, 0.1],
    tiltHeight: 0.2,
};

export function buildMovingHeadBeam(kit: BuilderKit): THREE.Object3D {
    const { root, tilt } = buildMovingHeadFrame(kit, "moving-head-beam", MOVING_HEAD_BEAM_LAYOUT);

    tilt.add(
        kit.lathe(
            [
                [0, -0.1],
                [0.05, -0.1],
                [0.072, -0.085],
                [0.075, -0.06],
                [0.075, 0.15],
                [0.06, 0.172],
                [0, 0.172],
            ],
            "body",
        ),
    );
    // lens barrel and glass
    tilt.add(
        kit.lathe(
            [
                [0.035, 0.168],
                [0.055, 0.168],
                [0.045, LENS_Y],
                [0.035, LENS_Y],
                [0.035, 0.168],
            ],
            "accent",
        ),
    );
    const glass = kit.cylinder(0.035, 0.035, 0.002, "glass", 24);
    glass.position.y = LENS_Y - 0.004;
    tilt.add(glass);

    return kit.mergeBySlot(root, ["pan", "tilt"]);
}
