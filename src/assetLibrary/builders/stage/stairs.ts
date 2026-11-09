/**
 * stage.stairs: stage access stairs (feature 002, T073). `steps = ceil(height / 0.20)`, rise = `height / steps`,
 * tread 0.28 m. Solid stepped stringers on both sides (slot `metal`), treads and risers slot `body`. The top step
 * ends at z = 0 and the stairs extend towards -Z (they are climbed towards +Z); centered on x, bottom at y = 0.
 */
import type * as THREE from "three";
import { numberParam } from "../../params";
import type { BuilderKit, ParamValues, Vec3 } from "../../types";

export const STAIR_TREAD = 0.28;
const MAX_RISE = 0.2;
const STRINGER = 0.04;
const TREAD_THICKNESS = 0.04;
const RISER_THICKNESS = 0.02;

function dimensions(p: ParamValues) {
    const width = numberParam(p, "width", 1);
    const height = numberParam(p, "height", 0.6);
    const steps = Math.max(1, Math.ceil(height / MAX_RISE - 1e-9));
    return { width, height, steps, rise: height / steps };
}

export function stairsSize(p: ParamValues): Vec3 {
    const { width, height, steps } = dimensions(p);
    return [width, height, steps * STAIR_TREAD];
}

export function buildStairs(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    const { width, steps, rise } = dimensions(p);
    const root = kit.group("stairs");
    const inner = width - 2 * STRINGER;
    const treadThickness = Math.min(TREAD_THICKNESS, rise);

    for (let i = 1; i <= steps; i++) {
        const top = i * rise;
        const back = -(steps - i) * STAIR_TREAD;
        const front = back - STAIR_TREAD;
        const centerZ = (front + back) / 2;

        // stringers: one solid column per step on each side, stepped like the treads
        for (const side of [-1, 1]) {
            const column = kit.box([STRINGER, top, STAIR_TREAD], "metal");
            column.position.set(side * (width - STRINGER) / 2, 0, centerZ);
            root.add(column);
        }

        const tread = kit.box([inner, treadThickness, STAIR_TREAD], "body");
        tread.position.set(0, top - treadThickness, centerZ);
        root.add(tread);

        const riserHeight = rise - treadThickness;
        if (riserHeight > 0.001) {
            const riser = kit.box([inner, riserHeight, RISER_THICKNESS], "body");
            riser.position.set(0, top - rise, front + RISER_THICKNESS / 2);
            root.add(riser);
        }
    }

    return kit.mergeBySlot(root);
}
