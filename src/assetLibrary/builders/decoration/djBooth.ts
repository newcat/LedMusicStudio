/**
 * decoration.dj-booth: a 2.0 × 1.1 × 0.8 m booth with a front facade panel, a top surface and side wings
 * (feature 002). The DJ stands behind it (−Z); the facade faces the audience (+Z).
 * Slots: `body` (facade and wings), `accent` (top surface, facade trim), `metal` (frame, shelf).
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const WIDTH = 2.0;
const HEIGHT = 1.1;
const DEPTH = 0.8;
const TOP = 0.04;
const PANEL = 0.03;
const WING = 0.04;

export function buildDjBooth(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("dj-booth");
    const frontZ = DEPTH / 2;
    const panelHeight = HEIGHT - TOP;

    // facade with a recessed band and a trim strip along its top and bottom
    const facade = kit.box([WIDTH - 2 * WING, panelHeight, PANEL], "body", { bevel: 0.004 });
    facade.position.set(0, 0, frontZ - PANEL / 2 - 0.02);
    root.add(facade);
    for (const y of [0.05, panelHeight - 0.09]) {
        const trim = kit.box([WIDTH - 2 * WING - 0.04, 0.04, 0.01], "accent");
        trim.position.set(0, y, frontZ - 0.02 + 0.005);
        root.add(trim);
    }

    // side wings: full-depth panels that reach slightly in front of the facade
    for (const sx of [-1, 1]) {
        const wing = kit.box([WING, panelHeight, DEPTH - 0.02], "body", { bevel: 0.004 });
        wing.position.set(sx * (WIDTH / 2 - WING / 2), 0, -0.01);
        root.add(wing);
    }

    // top surface with a small overhang at the front
    const top = kit.box([WIDTH, TOP, DEPTH], "accent", { bevel: 0.008 });
    top.position.y = panelHeight;
    root.add(top);

    // inner frame: two cross members and a shelf for gear at the back
    const inner = WIDTH - 2 * WING;
    const shelf = kit.box([inner, 0.025, DEPTH * 0.55], "metal");
    shelf.position.set(0, 0.35, -DEPTH * 0.15);
    root.add(shelf);
    for (const y of [0.02, panelHeight - 0.08]) {
        const rail = kit.box([inner, 0.04, 0.04], "metal");
        rail.position.set(0, y, -frontZ + 0.04);
        root.add(rail);
    }

    return kit.mergeBySlot(root);
}
