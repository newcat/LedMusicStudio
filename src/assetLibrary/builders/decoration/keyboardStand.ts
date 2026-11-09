/**
 * decoration.keyboard-stand: an 88-key keyboard on an X-stand, about 1.3 × 0.95 × 0.45 m (feature 002).
 * The player stands at +Z (the keys face the front).
 * Slots: `accent` (white keys), `body` (black keys, keyboard housing), `metal` (stand).
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const KEYBOARD = { width: 1.3, height: 0.12, depth: 0.34 };
const STAND_HEIGHT = 0.82;
const STAND_HALF_WIDTH = 0.36;
const FOOT_DEPTH = 0.45;
const ARM_DEPTH = 0.36;
const TUBE = 0.016;

const WHITE_KEYS = 52;
/** Black keys per octave position (C=0 … B=6): after C, D, F, G and A. */
const BLACK_AFTER = new Set([0, 1, 3, 4, 5]);

export function buildKeyboardStand(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("keyboard-stand");

    // X-stand seen from the front: two crossing tubes, feet and arms run front to back
    root.add(kit.tube([-STAND_HALF_WIDTH, 0.03, 0], [STAND_HALF_WIDTH, STAND_HEIGHT - 0.02, 0], TUBE, "metal"));
    root.add(kit.tube([STAND_HALF_WIDTH, 0.03, 0], [-STAND_HALF_WIDTH, STAND_HEIGHT - 0.02, 0], TUBE, "metal"));
    for (const sx of [-1, 1]) {
        root.add(kit.tube([sx * STAND_HALF_WIDTH, 0.015, -FOOT_DEPTH / 2], [sx * STAND_HALF_WIDTH, 0.015, FOOT_DEPTH / 2], 0.015, "metal"));
        root.add(
            kit.tube([sx * STAND_HALF_WIDTH, STAND_HEIGHT - 0.015, -ARM_DEPTH / 2], [sx * STAND_HALF_WIDTH, STAND_HEIGHT - 0.015, ARM_DEPTH / 2], 0.015, "metal"),
        );
    }
    const hub = kit.cylinder(0.035, 0.035, 0.06, "metal", 16);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, (STAND_HEIGHT + 0.01) / 2, -0.03);
    root.add(hub);

    // keyboard housing: a base with the key bed and a raised panel at the back
    const y0 = STAND_HEIGHT;
    const housing = kit.box([KEYBOARD.width, 0.06, KEYBOARD.depth], "body", { bevel: 0.01 });
    housing.position.y = y0;
    root.add(housing);
    const panel = kit.box([KEYBOARD.width, KEYBOARD.height - 0.06, 0.12], "body", { bevel: 0.01 });
    panel.position.set(0, y0 + 0.06, -KEYBOARD.depth / 2 + 0.06);
    root.add(panel);
    for (const sx of [-1, 1]) {
        const cheek = kit.box([0.04, 0.04, KEYBOARD.depth - 0.12], "body");
        cheek.position.set(sx * (KEYBOARD.width / 2 - 0.02), y0 + 0.06, 0.06);
        root.add(cheek);
    }

    // keys: one white key bed with thin gaps between the keys, black keys on top
    const keysWidth = KEYBOARD.width - 0.1;
    const keyWidth = keysWidth / WHITE_KEYS;
    const keyDepth = 0.15;
    const keyZ = KEYBOARD.depth / 2 - keyDepth / 2;
    const keyY = y0 + 0.06;
    const whiteKeys = kit.box([keysWidth, 0.02, keyDepth], "accent");
    whiteKeys.position.set(0, keyY, keyZ);
    root.add(whiteKeys);
    const left = -keysWidth / 2;
    for (let i = 1; i < WHITE_KEYS; i++) {
        const gap = kit.box([0.0015, 0.021, keyDepth - 0.004], "body");
        gap.position.set(left + i * keyWidth, keyY, keyZ + 0.002);
        root.add(gap);
    }
    // an 88-key keyboard starts at A0: white key 0 is A, so the octave position is (i + 5) % 7
    for (let i = 0; i < WHITE_KEYS - 1; i++) {
        if (!BLACK_AFTER.has((i + 5) % 7)) {
            continue;
        }
        const black = kit.box([keyWidth * 0.55, 0.014, keyDepth * 0.62], "body");
        black.position.set(left + (i + 1) * keyWidth, keyY + 0.02, keyZ - keyDepth * 0.19);
        root.add(black);
    }

    return kit.mergeBySlot(root);
}
