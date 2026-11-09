/**
 * decoration.amp: a guitar/bass stack of a 4 × 12" cabinet on casters with an amplifier head on top, about
 * 0.75 × 1.3 × 0.4 m, grille front towards +Z (feature 002).
 * Slots: `body` (tolex), `accent` (grille cloth, control panel), `metal` (corners, knobs, handle, casters).
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const WIDTH = 0.75;
const CASTER = 0.07;
const CAB = { height: 0.88, depth: 0.37 };
const HEAD = { width: 0.72, height: 0.3, depth: 0.29 };
const CORNER = 0.04;

function corners(kit: BuilderKit, root: THREE.Object3D, width: number, y0: number, height: number, frontZ: number, backZ: number) {
    const x = width / 2 - CORNER / 2 + 0.004;
    for (const y of [y0 - 0.004, y0 + height - CORNER + 0.004]) {
        for (const sx of [-1, 1]) {
            for (const z of [frontZ - CORNER / 2 + 0.004, backZ + CORNER / 2 - 0.004]) {
                const block = kit.box([CORNER, CORNER, CORNER], "metal");
                block.position.set(sx * x, Math.max(y, CASTER - 0.004), z);
                root.add(block);
            }
        }
    }
}

export function buildAmp(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("amp");
    const cabFront = CAB.depth / 2;
    const cabBack = -CAB.depth / 2;

    // four casters
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            const wheel = kit.cylinder(0.03, 0.03, 0.025, "metal", 12);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(sx * (WIDTH / 2 - 0.08) + 0.0125, 0.03, sz * (CAB.depth / 2 - 0.07));
            root.add(wheel);
            const fork = kit.box([0.04, CASTER - 0.03, 0.04], "metal");
            fork.position.set(sx * (WIDTH / 2 - 0.08), 0.03, sz * (CAB.depth / 2 - 0.07));
            root.add(fork);
        }
    }

    // cabinet with grille cloth, framed by a thin border
    const cab = kit.box([WIDTH, CAB.height, CAB.depth], "body", { bevel: 0.012 });
    cab.position.y = CASTER;
    root.add(cab);
    const grille = kit.box([WIDTH - 0.08, CAB.height - 0.1, 0.008], "accent");
    grille.position.set(0, CASTER + 0.05, cabFront);
    root.add(grille);
    corners(kit, root, WIDTH, CASTER, CAB.height, cabFront, cabBack);

    // amplifier head, flush with the back of the cabinet
    const headY = CASTER + CAB.height;
    const headZ = cabBack + HEAD.depth / 2;
    const head = kit.box([HEAD.width, HEAD.height, HEAD.depth], "body", { bevel: 0.012 });
    head.position.set(0, headY, headZ);
    root.add(head);
    const headFront = headZ + HEAD.depth / 2;
    const headGrille = kit.box([HEAD.width - 0.06, HEAD.height * 0.45, 0.006], "accent");
    headGrille.position.set(0, headY + HEAD.height * 0.45, headFront);
    root.add(headGrille);
    const panel = kit.box([HEAD.width - 0.06, 0.07, 0.006], "metal");
    panel.position.set(0, headY + 0.04, headFront);
    root.add(panel);
    for (let i = 0; i < 8; i++) {
        const knob = kit.cylinder(0.012, 0.014, 0.022, "accent", 12);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(-0.24 + i * 0.065, headY + 0.075, headFront + 0.006);
        root.add(knob);
    }
    // carrying handle
    const handle = kit.box([0.2, 0.025, 0.04], "metal");
    handle.position.set(0, headY + HEAD.height, headZ);
    root.add(handle);

    return kit.mergeBySlot(root);
}
