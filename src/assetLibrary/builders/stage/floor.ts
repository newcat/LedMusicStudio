/**
 * stage.floor: a floor area, a 0.01 m thick box with its top at y = 0.01 (feature 002, T076). Slot `body`.
 * Centered on x/z.
 */
import type * as THREE from "three";
import { numberParam } from "../../params";
import type { BuilderKit, ParamValues, Vec3 } from "../../types";

export const FLOOR_THICKNESS = 0.01;

export function floorSize(p: ParamValues): Vec3 {
    return [numberParam(p, "width", 10), FLOOR_THICKNESS, numberParam(p, "depth", 10)];
}

export function buildFloor(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    const root = kit.group("floor");
    root.add(kit.box(floorSize(p), "body"));
    return kit.mergeBySlot(root);
}
