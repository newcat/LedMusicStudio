/**
 * fixture.scanner: a mirror scanner (feature 002, T054). An upright box body on a base plate with the mirror
 * assembly on top. `pan` (axis y) sits at the mirror center and carries the fork; its child `tilt` (axis x, same
 * origin) holds the mirror plate. At rest the mirror faces up and the beam leaves it along +Y.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

/** Mirror center (pan and tilt pivot) above the floor. */
export const SCANNER_MIRROR_Y = 0.46;
/** Mirror surface relative to `tilt`. */
export const SCANNER_MIRROR_SURFACE = 0.004;
const BODY_TOP = 0.4;

export function buildScanner(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("scanner");

    // base plate, body, front panel with a display, rear cooling slots
    root.add(kit.box([0.25, 0.015, 0.25], "metal", { bevel: 0.006 }));
    const body = kit.box([0.21, BODY_TOP - 0.015, 0.21], "body", { bevel: 0.012 });
    body.position.y = 0.015;
    root.add(body);
    const display = kit.box([0.08, 0.035, 0.004], "glass");
    display.position.set(0, 0.08, 0.105);
    root.add(display);
    for (let i = 0; i < 5; i++) {
        const slot = kit.box([0.14, 0.008, 0.004], "accent");
        slot.position.set(0, 0.2 + i * 0.03, -0.105);
        root.add(slot);
    }
    // lens collar that sends the beam up into the mirror
    const collar = kit.cylinder(0.04, 0.045, 0.02, "accent", 20);
    collar.position.y = BODY_TOP;
    root.add(collar);

    const pan = kit.group("pan");
    pan.position.y = SCANNER_MIRROR_Y;
    root.add(pan);
    // turntable and fork around the mirror
    const turntable = kit.cylinder(0.06, 0.06, 0.01, "accent", 20);
    turntable.position.y = BODY_TOP + 0.02 - SCANNER_MIRROR_Y;
    pan.add(turntable);
    for (const side of [-1, 1]) {
        const prong = kit.box([0.008, 0.07, 0.03], "metal");
        prong.position.set(side * 0.065, BODY_TOP + 0.03 - SCANNER_MIRROR_Y, 0);
        pan.add(prong);
    }

    const tilt = kit.group("tilt");
    pan.add(tilt);
    // axle, backing plate and the mirror on top of it
    tilt.add(kit.tube([-0.061, 0, 0], [0.061, 0, 0], 0.005, "metal"));
    const backing = kit.box([0.11, 0.006, 0.09], "metal");
    backing.position.y = -0.003;
    tilt.add(backing);
    const mirror = kit.box([0.1, 0.002, 0.08], "glass");
    mirror.position.y = SCANNER_MIRROR_SURFACE - 0.002;
    tilt.add(mirror);

    return kit.mergeBySlot(root, ["pan", "tilt"]);
}
