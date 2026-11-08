/**
 * fixture.profile-spot: an ellipsoidal profile spot (feature 002, T053). Standing on its yoke with the barrel
 * axis along +Y: lamp housing at the bottom, shutter section with four shutter handles, lens tube with zoom knobs,
 * and a color frame holder with the lens at y = 0.7 m on top. No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";
import { addUBracket } from "./bracketCommon";

export const PROFILE_LENS_Y = 0.7;
export const PROFILE_LENS_RADIUS = 0.06;
const PIVOT_Y = 0.38;
const HOUSING_BOTTOM = 0.03;
const SHUTTER_Y = 0.22;
const TUBE_Y = 0.3;
const FRONT_Y = 0.62;
const FRAME_Y = 0.685;

export function buildProfileSpot(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("profile-spot");
    addUBracket(kit, root, { armX: 0.11, pivotY: PIVOT_Y, feet: 0.4, width: 0.045 });

    // lamp housing with a lamp cap underneath and a rear handle
    const housing = kit.box([0.17, SHUTTER_Y - HOUSING_BOTTOM, 0.2], "body", { bevel: 0.02 });
    housing.position.y = HOUSING_BOTTOM;
    root.add(housing);
    const cap = kit.cylinder(0.04, 0.045, 0.012, "accent", 16);
    cap.position.y = HOUSING_BOTTOM - 0.012;
    root.add(cap);
    root.add(kit.tube([0, 0.07, -0.1], [0, 0.07, -0.13], 0.008, "metal"));
    root.add(kit.tube([0, 0.18, -0.1], [0, 0.18, -0.13], 0.008, "metal"));
    root.add(kit.tube([0, 0.07, -0.13], [0, 0.18, -0.13], 0.008, "metal"));

    // shutter section with four diagonal shutter handles
    const shutter = kit.cylinder(0.09, 0.09, TUBE_Y - SHUTTER_Y, "body", 20);
    shutter.position.y = SHUTTER_Y;
    root.add(shutter);
    for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const y = SHUTTER_Y + 0.02 + i * 0.013;
        root.add(kit.tube([Math.cos(a) * 0.085, y, Math.sin(a) * 0.085], [Math.cos(a) * 0.125, y, Math.sin(a) * 0.125], 0.005, "metal"));
    }

    // clamp ring at the pivot, lens tube and front tube
    const ring = kit.cylinder(0.08, 0.08, 0.04, "accent", 20);
    ring.position.y = PIVOT_Y - 0.02;
    root.add(ring);
    const tube = kit.cylinder(0.072, 0.076, FRONT_Y - TUBE_Y, "body", 20);
    tube.position.y = TUBE_Y;
    root.add(tube);
    for (const y of [0.45, 0.55]) {
        root.add(kit.tube([0, y, -0.07], [0, y, -0.1], 0.012, "accent"));
    }
    const front = kit.cylinder(0.078, 0.078, FRAME_Y - FRONT_Y, "body", 20);
    front.position.y = FRONT_Y;
    root.add(front);

    // color frame holder and lens
    const frame = kit.box([0.17, 0.012, 0.17], "metal");
    frame.position.y = FRAME_Y;
    root.add(frame);
    const glass = kit.cylinder(PROFILE_LENS_RADIUS, PROFILE_LENS_RADIUS, PROFILE_LENS_Y - FRAME_Y - 0.012, "glass", 24);
    glass.position.y = FRAME_Y + 0.012;
    root.add(glass);

    return kit.mergeBySlot(root);
}
