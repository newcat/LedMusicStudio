/**
 * Shared parts of the moving head models (feature 002): base with display, U-shaped yoke on the `pan` node and the
 * axle hubs of the `tilt` node. All moving heads use the same node structure (research R3):
 * root → `pan` (axis y, on top of the base) → `tilt` (axis x, between the arm tops), beam along +Y of `tilt`.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

export interface MovingHeadLayout {
    /** Base box W × H × D. The `pan` node sits on its top center. */
    base: [number, number, number];
    /** Distance of the arm centers from the pan axis. */
    armX: number;
    /** Arm W × H × D; the arms start on a crossbar at the pan node. */
    arm: [number, number, number];
    /** Height of the tilt pivot above the pan node. */
    tiltHeight: number;
}

const CROSSBAR_HEIGHT = 0.02;

/** Tilt pivot in the model frame (on the pan axis), used for aiming (feature 004, R11). */
export function tiltPivotOf(layout: MovingHeadLayout): [number, number, number] {
    return [0, layout.base[1] + layout.tiltHeight, 0];
}

/** Builds root, base, `pan` with the yoke and an empty `tilt` node at the pivot. The caller fills `tilt`. */
export function buildMovingHeadFrame(kit: BuilderKit, name: string, layout: MovingHeadLayout): { root: THREE.Group; pan: THREE.Group; tilt: THREE.Group } {
    const [baseW, baseH, baseD] = layout.base;
    const [armW, armH, armD] = layout.arm;
    const root = kit.group(name);

    // base with a small display on the front (+Z)
    root.add(kit.box([baseW, baseH, baseD], "body", { bevel: 0.012 }));
    const display = kit.box([baseW * 0.35, baseH * 0.32, 0.004], "glass");
    display.position.set(0, baseH * 0.35, baseD / 2);
    root.add(display);

    const pan = kit.group("pan");
    pan.position.set(0, baseH, 0);
    root.add(pan);

    // turntable and crossbar
    pan.add(kit.cylinder(baseD * 0.3, baseD * 0.32, 0.01, "accent", 24));
    const crossbar = kit.box([layout.armX * 2 + armW, CROSSBAR_HEIGHT, armD], "body", { bevel: 0.006 });
    crossbar.position.y = 0.01;
    pan.add(crossbar);
    for (const side of [-1, 1]) {
        const arm = kit.box([armW, armH - 0.01, armD], "body", { bevel: 0.008 });
        arm.position.set(side * layout.armX, 0.01, 0);
        pan.add(arm);
        // axle hub on the outside of the arm at the tilt pivot
        const inner = side * (layout.armX + armW / 2);
        pan.add(kit.tube([inner, layout.tiltHeight, 0], [inner + side * 0.008, layout.tiltHeight, 0], armD * 0.32, "accent"));
    }

    const tilt = kit.group("tilt");
    tilt.position.set(0, layout.tiltHeight, 0);
    pan.add(tilt);

    // short axles between the arms and the head
    const gap = layout.armX - armW / 2;
    tilt.add(kit.tube([-gap, 0, 0], [gap, 0, 0], 0.012, "accent"));
    return { root, pan, tilt };
}
