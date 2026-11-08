/**
 * fixture.cold-spark: a cold spark machine (feature 002, T063). A low 0.35 × 0.25 × 0.35 m box on four feet with a
 * round outlet on top (+Y) and a control panel on the front. No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const FEET = 0.012;
const BODY: [number, number, number] = [0.35, 0.21, 0.35];
export const COLD_SPARK_OUTLET_RADIUS = 0.04;
/** Top of the outlet; the emitter sits 1 mm above. */
export const COLD_SPARK_OUTLET_Y = 0.25;

export function buildColdSpark(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("cold-spark");

    for (const x of [-0.14, 0.14]) {
        for (const z of [-0.14, 0.14]) {
            const foot = kit.cylinder(0.018, 0.02, FEET, "accent", 12);
            foot.position.set(x, 0, z);
            root.add(foot);
        }
    }
    const body = kit.box(BODY, "body", { bevel: 0.02 });
    body.position.y = FEET;
    root.add(body);
    const top = FEET + BODY[1];

    // front control panel with display and buttons
    const panel = kit.box([0.2, 0.08, 0.004], "accent");
    panel.position.set(0, 0.07, BODY[2] / 2);
    root.add(panel);
    const display = kit.box([0.08, 0.035, 0.002], "glass");
    display.position.set(-0.04, 0.09, BODY[2] / 2 + 0.003);
    root.add(display);
    for (const x of [0.03, 0.06]) {
        root.add(kit.tube([x, 0.105, BODY[2] / 2 + 0.002], [x, 0.105, BODY[2] / 2 + 0.008], 0.007, "metal"));
    }
    // vent grille on top
    for (let i = 0; i < 4; i++) {
        const slot = kit.box([0.004, 0.002, 0.2], "accent");
        slot.position.set(0.1 + i * 0.012, top, 0);
        root.add(slot);
        const mirrored = kit.box([0.004, 0.002, 0.2], "accent");
        mirrored.position.set(-0.1 - i * 0.012, top, 0);
        root.add(mirrored);
    }

    // round outlet: collar and nozzle ring
    root.add(
        kit.lathe(
            [
                [0.065, top],
                [0.065, top + 0.012],
                [0.05, COLD_SPARK_OUTLET_Y - 0.006],
                [0.05, COLD_SPARK_OUTLET_Y],
                [COLD_SPARK_OUTLET_RADIUS, COLD_SPARK_OUTLET_Y],
                [COLD_SPARK_OUTLET_RADIUS, COLD_SPARK_OUTLET_Y - 0.008],
                [0, COLD_SPARK_OUTLET_Y - 0.008],
            ],
            "metal",
            24,
        ),
    );

    return kit.mergeBySlot(root);
}
