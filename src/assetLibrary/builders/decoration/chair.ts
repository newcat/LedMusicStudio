/**
 * decoration.chair: a simple chair with a 0.45 × 0.45 m seat at 0.45 m and a backrest up to 0.85 m (feature 002).
 * Slots: `body` (seat, backrest), `accent` (legs). Front faces +Z, the backrest is at −Z.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const WIDTH = 0.45;
const SEAT_DEPTH = 0.45;
const TOTAL_DEPTH = 0.5;
const SEAT_HEIGHT = 0.45;
const SEAT_THICKNESS = 0.04;
const BACK_HEIGHT = 0.85;
const LEG = 0.04;

export function buildChair(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("chair");

    const backZ = -TOTAL_DEPTH / 2 + LEG / 2;
    const seatCenterZ = TOTAL_DEPTH / 2 - SEAT_DEPTH / 2;
    const frontZ = TOTAL_DEPTH / 2 - LEG / 2;
    const legX = WIDTH / 2 - LEG / 2;

    const seat = kit.box([WIDTH, SEAT_THICKNESS, SEAT_DEPTH], "body", { bevel: 0.008 });
    seat.position.set(0, SEAT_HEIGHT - SEAT_THICKNESS, seatCenterZ);
    root.add(seat);

    // front legs end under the seat, back legs continue up as backrest posts
    for (const sx of [-1, 1]) {
        const front = kit.box([LEG, SEAT_HEIGHT - SEAT_THICKNESS, LEG], "accent");
        front.position.set(sx * legX, 0, frontZ);
        root.add(front);
        const back = kit.box([LEG, BACK_HEIGHT, LEG], "accent");
        back.position.set(sx * legX, 0, backZ);
        root.add(back);
    }

    // backrest panel between the posts
    const panelHeight = 0.24;
    const panel = kit.box([WIDTH - 2 * LEG, panelHeight, 0.025], "body", { bevel: 0.005 });
    panel.position.set(0, BACK_HEIGHT - panelHeight - 0.02, backZ);
    root.add(panel);

    return kit.mergeBySlot(root);
}
