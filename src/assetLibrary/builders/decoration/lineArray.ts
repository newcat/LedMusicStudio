/**
 * decoration.line-array: six trapezoid-section cabinets hanging in a slight J-curve under a fly bar, 0.7 m wide
 * (feature 002). Standard base point (lowest point at y = 0); the user lifts it into place. Cabinets face +Z.
 * Slots: `body` (cabinets), `accent` (grilles), `metal` (fly bar, rigging plates).
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";
import { centerOnBase, taperBack } from "./shapes";

const WIDTH = 0.7;
const CABINET_HEIGHT = 0.24;
const CABINET_DEPTH = 0.4;
/** Height of the cabinet back relative to the front. */
const TAPER = 0.8;
/** Splay angle of each cabinet relative to the one above it (degrees), forming the J. */
const SPLAY = [0, 1, 2, 3, 5, 7];
const FLY_BAR = { height: 0.06, depth: 0.42, top: 0.12 };

function cabinet(kit: BuilderKit): THREE.Group {
    // local frame: the front-top edge is at the origin, the cabinet extends down (−Y) and back (−Z)
    const group = kit.group("cabinet");
    const body = taperBack(kit.box([WIDTH - 0.02, CABINET_HEIGHT, CABINET_DEPTH], "body"), TAPER);
    body.position.set(0, -CABINET_HEIGHT, -CABINET_DEPTH / 2);
    group.add(body);
    const grille = kit.box([WIDTH - 0.06, CABINET_HEIGHT - 0.03, 0.012], "accent");
    grille.position.set(0, -CABINET_HEIGHT + 0.015, 0.004);
    group.add(grille);
    // rigging plates on both sides
    for (const sx of [-1, 1]) {
        const plate = kit.box([0.012, CABINET_HEIGHT * 0.9, 0.12], "metal");
        plate.position.set(sx * (WIDTH / 2 - 0.006), -CABINET_HEIGHT * 0.95, -0.08);
        group.add(plate);
        const rearPlate = kit.box([0.012, CABINET_HEIGHT * TAPER * 0.9, 0.08], "metal");
        rearPlate.position.set(sx * (WIDTH / 2 - 0.006), -CABINET_HEIGHT * TAPER * 0.95, -CABINET_DEPTH + 0.05);
        group.add(rearPlate);
    }
    return group;
}

export function buildLineArray(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("line-array");

    // fly bar: a flat frame with two pick-up points on top
    const frame = kit.box([WIDTH, FLY_BAR.height, FLY_BAR.depth], "metal");
    frame.position.set(0, 0, -FLY_BAR.depth / 2 + 0.01);
    root.add(frame);
    for (const sx of [-1, 1]) {
        const bracket = kit.box([0.03, FLY_BAR.top - FLY_BAR.height, 0.03], "metal");
        bracket.position.set(sx * 0.2, FLY_BAR.height, -0.15);
        root.add(bracket);
        const shackle = kit.tube([sx * 0.2, FLY_BAR.top, -0.17], [sx * 0.2, FLY_BAR.top, -0.13], 0.012, "metal");
        root.add(shackle);
    }
    const rail = kit.box([WIDTH - 0.1, 0.02, 0.02], "metal");
    rail.position.set(0, FLY_BAR.height, -0.33);
    root.add(rail);

    // cabinets chained from their front edges, each tilted a little more towards the floor
    let y = -0.005;
    let z = 0;
    let angle = 0;
    for (const splay of SPLAY) {
        angle += (splay * Math.PI) / 180;
        const c = cabinet(kit);
        c.position.set(0, y, z);
        c.rotation.x = angle;
        root.add(c);
        y -= CABINET_HEIGHT * Math.cos(angle) + 0.004;
        z -= CABINET_HEIGHT * Math.sin(angle);
    }

    return kit.mergeBySlot(centerOnBase(kit, root, "line-array-base"));
}
