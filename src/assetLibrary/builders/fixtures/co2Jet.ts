/**
 * fixture.co2-jet: a CO2 / cryo jet (feature 002, T062). A cylindrical body on a square foot with a nozzle on top,
 * pointing up (+Y), and a hose connector at the back. No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

export const CO2_NOZZLE_RADIUS = 0.02;
/** Top of the nozzle; the emitter sits 1 mm above. */
export const CO2_NOZZLE_Y = 0.4;
const FOOT = 0.012;
const BODY_RADIUS = 0.08;
const BODY_TOP = 0.3;

export function buildCo2Jet(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("co2-jet");

    root.add(kit.box([0.2, FOOT, 0.2], "metal", { bevel: 0.01 }));
    root.add(
        kit.lathe(
            [
                [0, FOOT],
                [BODY_RADIUS, FOOT],
                [BODY_RADIUS, BODY_TOP - 0.03],
                [BODY_RADIUS - 0.015, BODY_TOP - 0.005],
                [0.03, BODY_TOP],
                [0, BODY_TOP],
            ],
            "body",
            20,
        ),
    );
    for (const y of [0.08, 0.22]) {
        const band = kit.cylinder(BODY_RADIUS + 0.003, BODY_RADIUS + 0.003, 0.012, "accent", 20);
        band.position.y = y;
        root.add(band);
    }

    // valve block and nozzle
    const valve = kit.cylinder(0.03, 0.03, 0.04, "metal", 16);
    valve.position.y = BODY_TOP;
    root.add(valve);
    root.add(
        kit.lathe(
            [
                [0.018, BODY_TOP + 0.04],
                [0.014, CO2_NOZZLE_Y - 0.03],
                [0.026, CO2_NOZZLE_Y],
                [CO2_NOZZLE_RADIUS, CO2_NOZZLE_Y],
                [CO2_NOZZLE_RADIUS, CO2_NOZZLE_Y - 0.004],
                [0, CO2_NOZZLE_Y - 0.004],
            ],
            "metal",
            16,
        ),
    );

    // hose connector at the back
    root.add(kit.tube([0, 0.05, -BODY_RADIUS + 0.01], [0, 0.05, -0.095], 0.012, "metal"));
    root.add(kit.tube([0, 0.05, -0.085], [0, 0.05, -0.1], 0.017, "accent"));

    return kit.mergeBySlot(root);
}
