/**
 * decoration.speaker-stack: a PA stack of a sub cabinet (0.6 m cube, two bass cones) and a top cabinet
 * (0.6 × 1.2 × 0.5 m, two 12" cones and a horn), 1.8 m high (feature 002). Cones face the front (+Z).
 * Slots: `body` (cabinets), `accent` (cones, horn), `metal` (corner protectors).
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const WIDTH = 0.6;
const SUB = { height: 0.6, depth: 0.6 };
const TOP = { height: 1.2, depth: 0.5 };
const CORNER = 0.035;

/** A cone of radius `radius` on the front face at z = `frontZ`, pointing +Z. */
function cone(kit: BuilderKit, root: THREE.Object3D, x: number, y: number, frontZ: number, radius: number) {
    const surround = kit.cylinder(radius, radius, 0.006, "metal", 24);
    surround.rotation.x = Math.PI / 2;
    surround.position.set(x, y, frontZ);
    root.add(surround);
    const membrane = kit.cylinder(radius * 0.3, radius * 0.92, 0.02, "accent", 24);
    membrane.rotation.x = Math.PI / 2;
    membrane.position.set(x, y, frontZ + 0.006);
    root.add(membrane);
    const cap = kit.cylinder(radius * 0.22, radius * 0.3, 0.012, "accent", 16);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(x, y, frontZ + 0.026);
    root.add(cap);
}

/** Small metal blocks on the eight corners of a cabinet that starts at `y0`. */
function corners(kit: BuilderKit, root: THREE.Object3D, y0: number, height: number, depth: number) {
    const x = WIDTH / 2 - CORNER / 2 + 0.003;
    const z = depth / 2 - CORNER / 2 + 0.003;
    for (const y of [y0 - 0.003, y0 + height - CORNER + 0.003]) {
        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
                const block = kit.box([CORNER, CORNER, CORNER], "metal");
                block.position.set(sx * x, Math.max(0, y), sz * z);
                root.add(block);
            }
        }
    }
}

export function buildSpeakerStack(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("speaker-stack");

    // sub cabinet
    const sub = kit.box([WIDTH, SUB.height, SUB.depth], "body", { bevel: 0.01 });
    root.add(sub);
    corners(kit, root, 0, SUB.height, SUB.depth);
    // two bass cones side by side (scaled to fit the 0.6 m front)
    for (const sx of [-1, 1]) {
        cone(kit, root, sx * 0.145, SUB.height / 2, SUB.depth / 2, 0.13);
    }

    // top cabinet, flush with the back of the sub
    const topZ = -(SUB.depth - TOP.depth) / 2;
    const top = kit.box([WIDTH, TOP.height, TOP.depth], "body", { bevel: 0.01 });
    top.position.set(0, SUB.height, topZ);
    root.add(top);
    const topFront = topZ + TOP.depth / 2;
    const topCorners = kit.group("top-corners");
    corners(kit, topCorners, SUB.height, TOP.height, TOP.depth);
    topCorners.position.z = topZ;
    root.add(topCorners);

    // two 12" cones and a horn above them
    cone(kit, root, 0, SUB.height + 0.22, topFront, 0.15);
    cone(kit, root, 0, SUB.height + 0.56, topFront, 0.15);
    const hornY = SUB.height + 0.92;
    const hornMouth = kit.box([0.42, 0.2, 0.02], "accent");
    hornMouth.position.set(0, hornY - 0.1, topFront + 0.01);
    root.add(hornMouth);
    const throat = kit.box([0.12, 0.05, 0.02], "metal");
    throat.position.set(0, hornY - 0.025, topFront + 0.025);
    root.add(throat);

    return kit.mergeBySlot(root);
}
