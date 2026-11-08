/**
 * fixture.strobe: a flat strobe (feature 002, T055). The 0.5 × 0.2 × 0.15 m housing lies on a U-bracket with its
 * front face (flash tube window) pointing up (+Y), so the built model is 0.5 m wide, 0.2 m deep and about 0.2 m
 * high. No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";
import { addUBracket } from "./bracketCommon";

const HOUSING: [number, number, number] = [0.5, 0.15, 0.2];
const HOUSING_BOTTOM = 0.04;
/** Top of the window glass; the tube emitter sits 1 mm above it. */
export const STROBE_WINDOW_Y = HOUSING_BOTTOM + HOUSING[1] + 0.006;

export function buildStrobe(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("strobe");
    addUBracket(kit, root, { armX: HOUSING[0] / 2 + 0.006, pivotY: HOUSING_BOTTOM + HOUSING[1] / 2, width: 0.05 });

    const housing = kit.box(HOUSING, "body", { bevel: 0.015 });
    housing.position.y = HOUSING_BOTTOM;
    root.add(housing);
    // cooling slots on both long sides
    for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
            const slot = kit.box([0.04, 0.06, 0.003], "accent");
            slot.position.set(-0.15 + i * 0.06, HOUSING_BOTTOM + 0.045, side * (HOUSING[2] / 2));
            root.add(slot);
        }
    }
    // front bezel, reflector and window
    const top = HOUSING_BOTTOM + HOUSING[1];
    const bezel = kit.box([0.46, 0.004, 0.13], "accent");
    bezel.position.y = top;
    root.add(bezel);
    const glass = kit.box([0.43, 0.002, 0.095], "glass");
    glass.position.y = top + 0.004;
    root.add(glass);

    return kit.mergeBySlot(root);
}
