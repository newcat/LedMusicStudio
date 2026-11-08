/**
 * decoration.table: a table with a 1.2 × 0.8 m top at 0.75 m on four square legs (feature 002).
 * Slots: `body` (top), `accent` (legs). Front faces +Z.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const WIDTH = 1.2;
const DEPTH = 0.8;
const HEIGHT = 0.75;
const TOP_THICKNESS = 0.04;
const LEG = 0.05;
const LEG_INSET = 0.04;

export function buildTable(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("table");

    const top = kit.box([WIDTH, TOP_THICKNESS, DEPTH], "body", { bevel: 0.01 });
    top.position.y = HEIGHT - TOP_THICKNESS;
    root.add(top);

    const legHeight = HEIGHT - TOP_THICKNESS;
    const x = WIDTH / 2 - LEG_INSET - LEG / 2;
    const z = DEPTH / 2 - LEG_INSET - LEG / 2;
    for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
    ]) {
        const leg = kit.box([LEG, legHeight, LEG], "accent");
        leg.position.set(sx * x, 0, sz * z);
        root.add(leg);
    }

    // apron under the top keeps the legs visually connected
    const apronHeight = 0.08;
    const apronY = legHeight - apronHeight;
    for (const sz of [-1, 1]) {
        const apron = kit.box([2 * x, apronHeight, 0.02], "accent");
        apron.position.set(0, apronY, sz * z);
        root.add(apron);
    }
    for (const sx of [-1, 1]) {
        const apron = kit.box([0.02, apronHeight, 2 * z], "accent");
        apron.position.set(sx * x, apronY, 0);
        root.add(apron);
    }

    return kit.mergeBySlot(root);
}
