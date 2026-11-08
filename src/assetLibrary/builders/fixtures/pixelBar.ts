/**
 * fixture.pixel-bar: a slim pixel bar (feature 002, T058). A 1.0 × 0.06 × 0.06 m bar lying along X on two low feet
 * with 16 pixel windows on its front, which points up (+Y). No moving parts.
 */
import type * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";

export const PIXEL_BAR_CELLS = 16;
const CELL_PITCH = 0.0625;
export const PIXEL_BAR_CELL_SIZE: [number, number] = [0.055, 0.04];
const BODY_BOTTOM = 0.012;
const BODY_HEIGHT = 0.045;
/** Top of the pixel windows; emitters sit 1 mm above. */
export const PIXEL_BAR_FRONT_Y = BODY_BOTTOM + BODY_HEIGHT + 0.002;

export function pixelBarCellPosition(index: number): Vec3 {
    return [(index - (PIXEL_BAR_CELLS - 1) / 2) * CELL_PITCH, PIXEL_BAR_FRONT_Y + 0.001, 0];
}

export function buildPixelBar(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("pixel-bar");

    for (const side of [-1, 1]) {
        const foot = kit.box([0.03, BODY_BOTTOM, 0.05], "metal", { bevel: 0.003 });
        foot.position.x = side * 0.38;
        root.add(foot);
    }
    const body = kit.box([0.99, BODY_HEIGHT, 0.055], "body", { bevel: 0.006 });
    body.position.y = BODY_BOTTOM;
    root.add(body);
    for (const side of [-1, 1]) {
        const cap = kit.box([0.005, BODY_HEIGHT + 0.002, 0.058], "accent");
        cap.position.set(side * 0.4975, BODY_BOTTOM - 0.001, 0);
        root.add(cap);
    }
    for (let i = 0; i < PIXEL_BAR_CELLS; i++) {
        const [x] = pixelBarCellPosition(i);
        const pane = kit.box([PIXEL_BAR_CELL_SIZE[0], 0.002, PIXEL_BAR_CELL_SIZE[1]], "glass");
        pane.position.set(x, BODY_BOTTOM + BODY_HEIGHT, 0);
        root.add(pane);
    }

    return kit.mergeBySlot(root);
}
