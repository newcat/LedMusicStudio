/**
 * fixture.led-profile: the parametric LED strip body (feature 002, T045). An aluminium U-channel (0.02 × 0.012 m)
 * with a diffuser along +X, centered on the origin, bottom at y = 0; the diffuser faces +Y.
 */
import type * as THREE from "three";
import type { BuilderKit, ParamValues, Vec3 } from "../../types";

export const LED_PROFILE_WIDTH = 0.02;
export const LED_PROFILE_HEIGHT = 0.02;
const CHANNEL_HEIGHT = 0.012;
const WALL = 0.0015;
const FLOOR = 0.002;

function lengthOf(p: ParamValues): number {
    return typeof p.length === "number" ? p.length : 1;
}

export function ledProfileSize(p: ParamValues): Vec3 {
    return [lengthOf(p), LED_PROFILE_HEIGHT, LED_PROFILE_WIDTH];
}

export function buildLedProfile(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    const length = lengthOf(p);
    const root = kit.group("led-profile");

    root.add(kit.box([length, FLOOR, LED_PROFILE_WIDTH], "metal"));
    for (const side of [-1, 1]) {
        const wall = kit.box([length, CHANNEL_HEIGHT, WALL], "metal");
        wall.position.z = side * (LED_PROFILE_WIDTH - WALL) / 2;
        root.add(wall);
    }
    // opal diffuser, clipped into the channel and standing out above it
    const diffuser = kit.box([length, LED_PROFILE_HEIGHT - CHANNEL_HEIGHT + 0.002, LED_PROFILE_WIDTH - 2 * WALL], "glass");
    diffuser.position.y = CHANNEL_HEIGHT - 0.002;
    root.add(diffuser);

    return kit.mergeBySlot(root);
}
