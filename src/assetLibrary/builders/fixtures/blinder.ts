/**
 * fixture.blinder: a 4-cell audience blinder (feature 002, T056). The 0.5 × 0.5 × 0.2 m housing lies on a U-bracket
 * with its front (2 × 2 reflector cups) pointing up (+Y). Built size about 0.53 × 0.26 × 0.5 m. No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";
import { addUBracket } from "./bracketCommon";

const HOUSING: [number, number, number] = [0.5, 0.2, 0.5];
const HOUSING_BOTTOM = 0.04;
const TOP = HOUSING_BOTTOM + HOUSING[1];
const CELL_OFFSET = 0.12;
export const BLINDER_CELL_RADIUS = 0.09;
/** Lamp glass surface; the emitters sit 1 mm above it. */
export const BLINDER_GLASS_Y = TOP + 0.004;

/**
 * Emitter position of cell 1…4: row by row, starting top-left as seen from the front. When the face is turned to the
 * audience (+Z) the far side (−Z) becomes the top, so cell 1 is at (−x, −z) and cell 4 at (+x, +z).
 */
export function blinderCellPosition(index: number): Vec3 {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return [(col === 0 ? -1 : 1) * CELL_OFFSET, BLINDER_GLASS_Y + 0.001, (row === 0 ? -1 : 1) * CELL_OFFSET];
}

export function buildBlinder(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("blinder");
    addUBracket(kit, root, { armX: HOUSING[0] / 2 + 0.006, pivotY: HOUSING_BOTTOM + HOUSING[1] / 2, width: 0.05 });

    const housing = kit.box(HOUSING, "body", { bevel: 0.02 });
    housing.position.y = HOUSING_BOTTOM;
    root.add(housing);

    for (let i = 0; i < 4; i++) {
        const [x, , z] = blinderCellPosition(i);
        const rim = kit.lathe(
            [
                [BLINDER_CELL_RADIUS, TOP],
                [0.11, TOP],
                [0.11, TOP + 0.012],
                [0.1, TOP + 0.012],
                [BLINDER_CELL_RADIUS, TOP + 0.006],
            ],
            "metal",
            20,
        );
        rim.position.set(x, 0, z);
        root.add(rim);
        const glass = kit.cylinder(BLINDER_CELL_RADIUS, BLINDER_CELL_RADIUS, 0.004, "glass", 20);
        glass.position.set(x, TOP, z);
        root.add(glass);
    }

    return kit.mergeBySlot(root);
}
