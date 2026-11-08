/**
 * fixture.laser: a show laser (feature 002, T060). A 0.25 × 0.15 × 0.3 m box standing level on four feet with the
 * aperture window on its front (+Z). No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const BODY: [number, number, number] = [0.25, 0.14, 0.3];
const FEET = 0.01;
/** Aperture center height and front plane of the window glass. */
export const LASER_APERTURE_Y = 0.085;
export const LASER_FRONT_Z = BODY[2] / 2 + 0.005;

export function buildLaser(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("laser");

    for (const x of [-0.1, 0.1]) {
        for (const z of [-0.12, 0.12]) {
            const foot = kit.cylinder(0.012, 0.012, FEET, "accent", 12);
            foot.position.set(x, 0, z);
            root.add(foot);
        }
    }
    const body = kit.box(BODY, "body", { bevel: 0.01 });
    body.position.y = FEET;
    root.add(body);

    // cooling fins on the top
    for (let i = 0; i < 7; i++) {
        const fin = kit.box([0.18, 0.004, 0.006], "accent");
        fin.position.set(0, FEET + BODY[1], -0.1 + i * 0.03);
        root.add(fin);
    }
    // front: aperture frame and window
    const frame = kit.box([0.1, 0.06, 0.004], "metal");
    frame.position.set(0, LASER_APERTURE_Y - 0.03, BODY[2] / 2 + 0.002);
    root.add(frame);
    const glass = kit.box([0.07, 0.035, 0.002], "glass");
    glass.position.set(0, LASER_APERTURE_Y - 0.0175, LASER_FRONT_Z - 0.001);
    root.add(glass);
    // key switch and status light on the rear
    root.add(kit.tube([0.06, 0.08, -BODY[2] / 2], [0.06, 0.08, -BODY[2] / 2 - 0.01], 0.01, "metal"));
    root.add(kit.tube([-0.06, 0.08, -BODY[2] / 2], [-0.06, 0.08, -BODY[2] / 2 - 0.006], 0.005, "glass"));

    return kit.mergeBySlot(root);
}
