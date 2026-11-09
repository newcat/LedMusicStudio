/**
 * decoration.mic-stand: a microphone stand with a tripod base, a 1.0 m vertical pole, a boom arm towards +Z and a
 * microphone, about 0.5 × 1.6 × 0.5 m (feature 002).
 * Slots: `body` (stand, microphone handle), `metal` (clutches, microphone grille).
 */
import * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";
import { centerOnBase, sphere } from "./shapes";

const LEG_SPREAD = 0.27;
const HUB_Y = 0.3;
const POLE_LENGTH = 1.0;
const BOOM_ANGLE = (28 * Math.PI) / 180;
const BOOM_FRONT = 0.25;
const BOOM_BACK = 0.16;

export function buildMicStand(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("mic-stand");

    // tripod: one leg under the boom (front), two towards the back corners
    for (let i = 0; i < 3; i++) {
        const a = (i * 2 * Math.PI) / 3;
        root.add(kit.tube([Math.sin(a) * LEG_SPREAD, 0.008, Math.cos(a) * LEG_SPREAD], [0, HUB_Y, 0], 0.01, "body"));
    }
    const hub = kit.cylinder(0.022, 0.022, 0.06, "body", 16);
    hub.position.y = HUB_Y - 0.04;
    root.add(hub);

    // lower tube, height clutch, upper tube: together the 1.0 m vertical pole
    const top = HUB_Y + POLE_LENGTH;
    root.add(kit.tube([0, HUB_Y - 0.04, 0], [0, HUB_Y + 0.55, 0], 0.012, "body"));
    const clutch = kit.cylinder(0.02, 0.02, 0.04, "metal", 16);
    clutch.position.y = HUB_Y + 0.53;
    root.add(clutch);
    root.add(kit.tube([0, HUB_Y + 0.55, 0], [0, top, 0], 0.009, "body"));
    const boomClutch = sphere(kit, [0, top, 0], 0.025, "metal", 12);
    root.add(boomClutch);

    // boom arm rising towards the front, with a counterweight at the back end
    const dir = new THREE.Vector3(0, Math.sin(BOOM_ANGLE), Math.cos(BOOM_ANGLE));
    const pivot = new THREE.Vector3(0, top, 0);
    const front = pivot.clone().addScaledVector(dir, BOOM_FRONT);
    const back = pivot.clone().addScaledVector(dir, -BOOM_BACK);
    const toVec = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
    root.add(kit.tube(toVec(back), toVec(front), 0.008, "body"));
    const weight = kit.cylinder(0.022, 0.022, 0.05, "body", 12);
    weight.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    weight.position.copy(back);
    root.add(weight);

    // microphone: clip, handle and grille, continuing the boom direction
    const micDir = new THREE.Vector3(0, Math.sin(BOOM_ANGLE * 1.6), Math.cos(BOOM_ANGLE * 1.6));
    const clipEnd = front.clone().addScaledVector(micDir, 0.03);
    root.add(kit.tube(toVec(front), toVec(clipEnd), 0.014, "metal"));
    const handle = kit.cylinder(0.02, 0.014, 0.13, "body", 16);
    handle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), micDir);
    handle.position.copy(clipEnd);
    root.add(handle);
    const headCenter = clipEnd.clone().addScaledVector(micDir, 0.13 + 0.022);
    root.add(sphere(kit, toVec(headCenter), 0.03, "metal", 14));

    return kit.mergeBySlot(centerOnBase(kit, root, "mic-stand-base"));
}
