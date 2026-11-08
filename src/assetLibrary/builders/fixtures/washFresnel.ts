/**
 * fixture.wash-fresnel: a Fresnel / PC wash (feature 002, T052). A static U-bracket holds a can (radius 0.12 m)
 * that points up (+Y); the stepped Fresnel lens sits at y = 0.32 m and a 4-leaf barn door opens above it.
 * No moving parts.
 */
import * as THREE from "three";
import type { BuilderKit } from "../../types";
import { addUBracket } from "./bracketCommon";

export const FRESNEL_LENS_Y = 0.32;
export const FRESNEL_LENS_RADIUS = 0.1;
const CAN_RADIUS = 0.12;
const CAN_BOTTOM = 0.07;
const PIVOT_Y = 0.19;
const FLAP_HEIGHT = 0.075;
const FLAP_ANGLE = THREE.MathUtils.degToRad(25);

export function buildWashFresnel(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("wash-fresnel");
    addUBracket(kit, root, { armX: CAN_RADIUS + 0.012, pivotY: PIVOT_Y, feet: 0.26 });

    // can with a rounded back and cooling ribs
    root.add(
        kit.lathe(
            [
                [0, CAN_BOTTOM],
                [0.07, CAN_BOTTOM],
                [0.105, CAN_BOTTOM + 0.02],
                [CAN_RADIUS, CAN_BOTTOM + 0.06],
                [CAN_RADIUS, FRESNEL_LENS_Y - 0.012],
                [0, FRESNEL_LENS_Y - 0.012],
            ],
            "body",
        ),
    );
    for (const y of [0.15, 0.17, 0.21, 0.23]) {
        const rib = kit.cylinder(CAN_RADIUS + 0.004, CAN_RADIUS + 0.004, 0.006, "accent", 24);
        rib.position.y = y;
        root.add(rib);
    }

    // front ring (also the barn door holder)
    root.add(
        kit.lathe(
            [
                [FRESNEL_LENS_RADIUS, FRESNEL_LENS_Y - 0.012],
                [CAN_RADIUS + 0.006, FRESNEL_LENS_Y - 0.012],
                [CAN_RADIUS + 0.006, FRESNEL_LENS_Y + 0.006],
                [FRESNEL_LENS_RADIUS, FRESNEL_LENS_Y + 0.006],
                [FRESNEL_LENS_RADIUS, FRESNEL_LENS_Y - 0.012],
            ],
            "metal",
        ),
    );

    // stepped Fresnel lens: concentric rings that step down towards the rim, top face at the lens plane
    const steps = 5;
    const profile: Array<[number, number]> = [[0, FRESNEL_LENS_Y]];
    for (let i = 1; i <= steps; i++) {
        const r = (FRESNEL_LENS_RADIUS * i) / steps;
        const top = FRESNEL_LENS_Y - 0.0012 * (i - 1);
        profile.push([r, top - 0.0035], [r, top - 0.0012]);
    }
    profile.pop();
    profile.push([FRESNEL_LENS_RADIUS, FRESNEL_LENS_Y - 0.01]);
    root.add(kit.lathe(profile, "glass"));

    // barn doors: two wide leaves on the ±Z sides, two narrow ones on the ±X sides, hinged at the ring and opened
    const hingeY = FRESNEL_LENS_Y + 0.006;
    const hingeR = CAN_RADIUS + 0.004;
    for (const side of [-1, 1]) {
        const wide = kit.box([0.22, FLAP_HEIGHT, 0.003], "metal");
        wide.position.set(0, hingeY, side * hingeR);
        wide.rotation.x = side * FLAP_ANGLE;
        root.add(wide);
        const narrow = kit.box([0.003, FLAP_HEIGHT, 0.14], "metal");
        narrow.position.set(side * hingeR, hingeY, 0);
        narrow.rotation.z = -side * FLAP_ANGLE;
        root.add(narrow);
    }

    return kit.mergeBySlot(root);
}
