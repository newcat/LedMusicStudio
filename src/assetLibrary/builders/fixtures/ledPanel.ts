/**
 * fixture.led-panel: an 8 × 8 LED matrix panel (feature 002, T059). The 0.5 × 0.5 × 0.08 m panel stands upright on
 * a foot with its front facing the audience (+Z); built size about 0.5 × 0.56 × 0.2 m. No beam, only cells.
 */
import type * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";

export const LED_PANEL_GRID = 8;
const CELL_PITCH = 0.06;
export const LED_PANEL_CELL_SIZE = 0.055;
const PANEL_BOTTOM = 0.06;
const PANEL_SIZE = 0.5;
const PANEL_CENTER_Y = PANEL_BOTTOM + PANEL_SIZE / 2;
/** Front face of the screen; emitters sit 1 mm in front of it. */
export const LED_PANEL_FRONT_Z = 0.04;

/** Emitter position of cell (row, col), both 1-based; row 1 is at the top, col 1 on the left seen from the front. */
export function ledPanelCellPosition(row: number, col: number): Vec3 {
    const half = (LED_PANEL_GRID - 1) / 2;
    return [(col - 1 - half) * CELL_PITCH, PANEL_CENTER_Y + (half - (row - 1)) * CELL_PITCH, LED_PANEL_FRONT_Z + 0.001];
}

export function buildLedPanel(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("led-panel");

    // foot: base plate and two posts into the panel bottom
    root.add(kit.box([0.32, 0.012, 0.2], "metal", { bevel: 0.006 }));
    for (const side of [-1, 1]) {
        const post = kit.box([0.03, PANEL_BOTTOM, 0.03], "metal");
        post.position.set(side * 0.13, 0.01, 0);
        root.add(post);
    }

    // cabinet, screen and rear handles
    const cabinet = kit.box([PANEL_SIZE, PANEL_SIZE, 0.075], "body", { bevel: 0.006 });
    cabinet.position.set(0, PANEL_BOTTOM, -0.0025);
    root.add(cabinet);
    const screen = kit.box([0.49, 0.49, 0.005], "screen");
    screen.position.set(0, PANEL_BOTTOM + 0.005, LED_PANEL_FRONT_Z - 0.0025);
    root.add(screen);
    for (const side of [-1, 1]) {
        root.add(kit.tube([side * 0.08, PANEL_BOTTOM + 0.44, -0.04], [side * 0.08, PANEL_BOTTOM + 0.44, -0.06], 0.006, "metal"));
    }
    root.add(kit.tube([-0.08, PANEL_BOTTOM + 0.44, -0.06], [0.08, PANEL_BOTTOM + 0.44, -0.06], 0.006, "metal"));

    return kit.mergeBySlot(root);
}
