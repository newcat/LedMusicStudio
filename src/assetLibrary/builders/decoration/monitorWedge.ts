/**
 * decoration.monitor-wedge: a 0.55 × 0.35 × 0.45 m wedge cabinet whose front faces +Z and up at 40°, with a grille
 * and side handles (feature 002). Slots: `body` (cabinet), `accent` (grille), `metal` (handles, feet).
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";
import { prism } from "./shapes";

const WIDTH = 0.55;
const HEIGHT = 0.35;
const DEPTH = 0.45;
/** The front normal points 40° above the horizon, so the front face rises 50° from the floor. */
const FACE_ANGLE = (40 * Math.PI) / 180;
const LIP = 0.05;
const FEET = 0.012;

export function buildMonitorWedge(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("monitor-wedge");

    const front = DEPTH / 2;
    const back = -DEPTH / 2;
    const rise = HEIGHT - FEET - LIP;
    const faceTopZ = front - rise * Math.tan(FACE_ANGLE);
    const backHeight = HEIGHT - FEET - 0.07;
    const cabinet = prism(
        [
            [front, 0],
            [front, LIP],
            [faceTopZ, HEIGHT - FEET],
            [back, backHeight],
            [back, 0],
        ],
        WIDTH,
        "body",
    );
    cabinet.position.y = FEET;
    root.add(cabinet);

    // grille on the sloped face
    const faceLength = rise / Math.cos(FACE_ANGLE);
    const grille = kit.box([WIDTH - 0.06, 0.012, faceLength - 0.04], "accent");
    // tilted so its thin axis follows the face normal; the box's bottom center sits on the face center
    grille.rotation.x = Math.PI / 2 - FACE_ANGLE;
    grille.position.set(0, FEET + LIP + rise / 2, (front + faceTopZ) / 2);
    root.add(grille);

    // side handles and four rubber feet
    for (const sx of [-1, 1]) {
        const handle = kit.box([0.015, 0.04, 0.14], "metal");
        handle.position.set(sx * (WIDTH / 2 + 0.006), backHeight * 0.55, -0.08);
        root.add(handle);
        for (const z of [front - 0.05, back + 0.05]) {
            const foot = kit.cylinder(0.02, 0.02, FEET, "metal", 12);
            foot.position.set(sx * (WIDTH / 2 - 0.05), 0, z);
            root.add(foot);
        }
    }

    return kit.mergeBySlot(root);
}
