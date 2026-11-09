/**
 * decoration.bar-counter: a 3.0 × 1.1 × 0.7 m bar counter with a top that overhangs the guest side (+Z), a plinth and
 * a foot rail (feature 002). Slots: `body` (counter front and sides), `accent` (counter top, plinth), `metal` (foot rail).
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const WIDTH = 3.0;
const HEIGHT = 1.1;
const DEPTH = 0.7;
const TOP = 0.05;
const BODY_DEPTH = 0.52;
const PLINTH = 0.1;
const RAIL = { y: 0.22, radius: 0.025, z: 0.29 };

export function buildBarCounter(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("bar-counter");
    const bodyBack = -DEPTH / 2;
    const bodyCenterZ = bodyBack + BODY_DEPTH / 2;
    const bodyFront = bodyBack + BODY_DEPTH;

    // recessed plinth, counter body and three front panels separated by vertical strips
    const plinth = kit.box([WIDTH - 0.04, PLINTH, BODY_DEPTH - 0.04], "accent");
    plinth.position.set(0, 0, bodyCenterZ - 0.02);
    root.add(plinth);
    const body = kit.box([WIDTH - 0.02, HEIGHT - TOP - PLINTH, BODY_DEPTH], "body", { bevel: 0.006 });
    body.position.set(0, PLINTH, bodyCenterZ);
    root.add(body);
    for (const x of [-WIDTH / 6, WIDTH / 6]) {
        const strip = kit.box([0.03, HEIGHT - TOP - PLINTH - 0.08, 0.012], "accent");
        strip.position.set(x, PLINTH + 0.04, bodyFront);
        root.add(strip);
    }

    // counter top, overhanging the guest side
    const top = kit.box([WIDTH, TOP, DEPTH], "accent", { bevel: 0.015 });
    top.position.y = HEIGHT - TOP;
    root.add(top);

    // foot rail on brackets
    const railLength = WIDTH - 0.3;
    root.add(kit.tube([-railLength / 2, RAIL.y, RAIL.z], [railLength / 2, RAIL.y, RAIL.z], RAIL.radius, "metal"));
    for (const x of [-railLength / 2, 0, railLength / 2]) {
        root.add(kit.tube([x, RAIL.y, bodyFront], [x, RAIL.y, RAIL.z], 0.012, "metal"));
    }

    return kit.mergeBySlot(root);
}
