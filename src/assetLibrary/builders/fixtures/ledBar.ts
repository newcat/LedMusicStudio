/**
 * fixture.led-bar: an LED bar / batten (feature 002, T057). A 1.0 × 0.1 × 0.1 m bar lying along X on two small feet
 * with its front (8 cell windows, left to right along +X) pointing up (+Y). No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";

export const LED_BAR_CELLS = 8;
const CELL_PITCH = 0.12;
export const LED_BAR_CELL_SIZE: [number, number] = [0.1, 0.06];
const BODY_BOTTOM = 0.02;
const BODY_HEIGHT = 0.076;
/** Top of the cell windows; emitters and beam sit 1 mm above. */
export const LED_BAR_FRONT_Y = BODY_BOTTOM + BODY_HEIGHT + 0.003;

export function ledBarCellPosition(index: number): Vec3 {
    return [(index - (LED_BAR_CELLS - 1) / 2) * CELL_PITCH, LED_BAR_FRONT_Y + 0.001, 0];
}

export function buildLedBar(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("led-bar");

    // feet with clamp knobs
    for (const side of [-1, 1]) {
        const foot = kit.box([0.04, BODY_BOTTOM, 0.09], "metal", { bevel: 0.004 });
        foot.position.x = side * 0.35;
        root.add(foot);
        root.add(kit.tube([side * 0.35, 0.012, 0.045], [side * 0.35, 0.012, 0.05], 0.01, "accent"));
    }

    const body = kit.box([0.988, BODY_HEIGHT, 0.1], "body", { bevel: 0.01 });
    body.position.y = BODY_BOTTOM;
    root.add(body);
    for (const side of [-1, 1]) {
        const cap = kit.box([0.006, BODY_HEIGHT, 0.1], "accent", { bevel: 0.01 });
        cap.position.set(side * 0.497, BODY_BOTTOM, 0);
        root.add(cap);
    }
    for (let i = 0; i < LED_BAR_CELLS; i++) {
        const [x] = ledBarCellPosition(i);
        const pane = kit.box([LED_BAR_CELL_SIZE[0], 0.003, LED_BAR_CELL_SIZE[1]], "glass");
        pane.position.set(x, BODY_BOTTOM + BODY_HEIGHT, 0);
        root.add(pane);
    }

    return kit.mergeBySlot(root);
}
