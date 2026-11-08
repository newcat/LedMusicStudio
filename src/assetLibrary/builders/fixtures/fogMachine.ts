/**
 * fixture.fog-machine: a fog machine / hazer (feature 002, T064). A 0.5 m wide box on two runners with a carrying
 * handle on top and the fog nozzle on its front (+Z). No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const RUNNER = 0.012;
const BODY: [number, number, number] = [0.5, 0.19, 0.22];
const BODY_Z = -0.015;
export const FOG_NOZZLE_RADIUS = 0.02;
export const FOG_NOZZLE_Y = 0.1;
/** Front of the nozzle tip; the emitter sits 1 mm in front of it. */
export const FOG_NOZZLE_Z = 0.125;

export function buildFogMachine(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("fog-machine");

    for (const x of [-0.2, 0.2]) {
        const runner = kit.box([0.03, RUNNER, 0.2], "accent", { bevel: 0.004 });
        runner.position.set(x, 0, BODY_Z);
        root.add(runner);
    }
    const body = kit.box(BODY, "body", { bevel: 0.015 });
    body.position.set(0, RUNNER, BODY_Z);
    root.add(body);
    const top = RUNNER + BODY[1];
    const front = BODY_Z + BODY[2] / 2;

    // handle on top
    for (const x of [-0.12, 0.12]) {
        root.add(kit.tube([x, top, BODY_Z], [x, 0.24, BODY_Z], 0.008, "metal"));
    }
    root.add(kit.tube([-0.128, 0.24, BODY_Z], [0.128, 0.24, BODY_Z], 0.01, "metal"));

    // front: nozzle cone and tip, fluid level window and a cable socket
    root.add(kit.tube([0, FOG_NOZZLE_Y, front], [0, FOG_NOZZLE_Y, front + 0.015], 0.03, "accent"));
    root.add(kit.tube([0, FOG_NOZZLE_Y, front + 0.015], [0, FOG_NOZZLE_Y, FOG_NOZZLE_Z], 0.024, "metal"));
    const pane = kit.box([0.06, 0.08, 0.003], "glass");
    pane.position.set(0.17, 0.05, front);
    root.add(pane);
    root.add(kit.tube([-0.17, 0.1, front], [-0.17, 0.1, front + 0.01], 0.012, "accent"));

    return kit.mergeBySlot(root);
}
