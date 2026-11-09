/**
 * stage.wall: a plain wall, one box (feature 002, T075). Slot `body`. Centered on x/z, bottom at y = 0.
 */
import type * as THREE from "three";
import { numberParam } from "../../params";
import type { BuilderKit, ParamValues, Vec3 } from "../../types";

export function wallSize(p: ParamValues): Vec3 {
    return [numberParam(p, "width", 4), numberParam(p, "height", 3), numberParam(p, "thickness", 0.2)];
}

export function buildWall(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    const root = kit.group("wall");
    root.add(kit.box(wallSize(p), "body"));
    return kit.mergeBySlot(root);
}
