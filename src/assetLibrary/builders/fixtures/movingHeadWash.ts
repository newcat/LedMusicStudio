/**
 * fixture.moving-head-wash: an LED wash moving head (feature 002, T040). Same node structure as the spot model,
 * with a wide, short head (radius 0.15 m) whose flat front plate carries 7 LED lenses in a hexagonal pattern.
 */
import type * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";
import { buildMovingHeadFrame } from "./movingHeadCommon";

/** Front plate surface, relative to `tilt`. */
export const WASH_PLATE_Y = 0.12;
export const WASH_CELL_RADIUS = 0.03;
const HEX_RADIUS = 0.075;

/** Centers of the 7 LED cells on the plate (x, z): the center first, then the ring counter-clockwise from +X. */
export const WASH_CELL_CENTERS: Array<[number, number]> = [
    [0, 0],
    ...Array.from({ length: 6 }, (_, i): [number, number] => {
        const a = (i * Math.PI) / 3;
        return [Math.round(Math.cos(a) * HEX_RADIUS * 1e4) / 1e4, Math.round(-Math.sin(a) * HEX_RADIUS * 1e4) / 1e4];
    }),
];

/** Emitter positions of the cells, 2 mm in front of the plate. */
export function washCellPosition(index: number): Vec3 {
    const [x, z] = WASH_CELL_CENTERS[index];
    return [x, WASH_PLATE_Y + 0.002, z];
}

export function buildMovingHeadWash(kit: BuilderKit): THREE.Object3D {
    const { root, tilt } = buildMovingHeadFrame(kit, "moving-head-wash", {
        base: [0.36, 0.14, 0.32],
        armX: 0.18,
        arm: [0.04, 0.32, 0.13],
        tiltHeight: 0.285,
    });

    tilt.add(
        kit.lathe(
            [
                [0, -0.1],
                [0.09, -0.1],
                [0.135, -0.08],
                [0.15, -0.04],
                [0.15, 0.105],
                [0.145, 0.114],
                [0, 0.114],
            ],
            "body",
        ),
    );
    const plate = kit.cylinder(0.14, 0.14, WASH_PLATE_Y - 0.002 - 0.112, "accent", 24);
    plate.position.y = 0.112;
    tilt.add(plate);
    for (const [x, z] of WASH_CELL_CENTERS) {
        const lens = kit.cylinder(WASH_CELL_RADIUS, WASH_CELL_RADIUS, 0.002, "glass", 16);
        lens.position.set(x, WASH_PLATE_Y - 0.002, z);
        tilt.add(lens);
    }

    return kit.mergeBySlot(root, ["pan", "tilt"]);
}
