/**
 * fixture.flame-projector: a flame projector (feature 002, T061). A square base box with side handles, a nozzle pipe
 * pointing up (+Y) and a pilot shield next to the nozzle. No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const BASE: [number, number, number] = [0.28, 0.22, 0.28];
export const FLAME_NOZZLE_RADIUS = 0.03;
/** Top of the nozzle tip; the emitter sits 1 mm above. */
export const FLAME_NOZZLE_Y = 0.4;

export function buildFlameProjector(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("flame-projector");

    const base = kit.box(BASE, "body", { bevel: 0.015 });
    root.add(base);
    const plate = kit.box([0.2, 0.008, 0.2], "metal");
    plate.position.y = BASE[1];
    root.add(plate);
    // front panel with a status display and side handles
    const panel = kit.box([0.12, 0.05, 0.004], "glass");
    panel.position.set(0, 0.12, BASE[2] / 2);
    root.add(panel);
    for (const side of [-1, 1]) {
        const x = side * (BASE[0] / 2 + 0.01);
        root.add(kit.tube([x, 0.17, -0.07], [x, 0.17, 0.07], 0.008, "metal"));
        root.add(kit.tube([side * (BASE[0] / 2), 0.17, -0.07], [x, 0.17, -0.07], 0.008, "metal"));
        root.add(kit.tube([side * (BASE[0] / 2), 0.17, 0.07], [x, 0.17, 0.07], 0.008, "metal"));
    }

    // nozzle pipe with a flange and a widened tip
    const flange = kit.cylinder(0.055, 0.055, 0.015, "metal", 20);
    flange.position.y = BASE[1] + 0.008;
    root.add(flange);
    const pipe = kit.cylinder(0.022, 0.022, FLAME_NOZZLE_Y - 0.03 - BASE[1], "metal", 16);
    pipe.position.y = BASE[1];
    root.add(pipe);
    root.add(
        kit.lathe(
            [
                [0.022, FLAME_NOZZLE_Y - 0.03],
                [0.04, FLAME_NOZZLE_Y - 0.01],
                [0.04, FLAME_NOZZLE_Y],
                [FLAME_NOZZLE_RADIUS, FLAME_NOZZLE_Y],
                [FLAME_NOZZLE_RADIUS, FLAME_NOZZLE_Y - 0.004],
                [0, FLAME_NOZZLE_Y - 0.004],
            ],
            "accent",
            20,
        ),
    );

    // pilot burner and its shield behind the nozzle
    root.add(kit.tube([0, BASE[1], -0.045], [0, FLAME_NOZZLE_Y - 0.02, -0.045], 0.006, "metal"));
    const shield = kit.box([0.08, 0.11, 0.004], "metal");
    shield.position.set(0, FLAME_NOZZLE_Y - 0.12, -0.06);
    root.add(shield);

    return kit.mergeBySlot(root);
}
