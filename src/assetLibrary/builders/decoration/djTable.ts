/**
 * decoration.dj-table: a 1.2 × 0.6 m table with two CDJ-style players and a mixer in the middle, 0.95 m high
 * (feature 002). The DJ stands at −Z; the players face him, the front of the table (+Z) faces the audience.
 * Slots: `body` (players, mixer), `accent` (table top, jog wheels), `metal` (legs, knobs), `screen` (displays).
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const WIDTH = 1.2;
const DEPTH = 0.6;
const TABLE_HEIGHT = 0.86;
const TOP = 0.035;
const LEG = 0.035;

const PLAYER = { width: 0.32, height: 0.07, depth: 0.4 };
const MIXER = { width: 0.3, height: 0.08, depth: 0.38 };

function player(kit: BuilderKit, root: THREE.Object3D, x: number, y: number) {
    const body = kit.box([PLAYER.width, PLAYER.height, PLAYER.depth], "body", { bevel: 0.01 });
    body.position.set(x, y, 0);
    root.add(body);
    const top = y + PLAYER.height;
    // jog wheel in the lower (DJ-side) half, the display above it
    const jog = kit.cylinder(0.1, 0.1, 0.012, "accent", 24);
    jog.position.set(x, top, -0.06);
    root.add(jog);
    const jogDisplay = kit.cylinder(0.035, 0.035, 0.004, "screen", 16);
    jogDisplay.position.set(x, top + 0.012, -0.06);
    root.add(jogDisplay);
    const display = kit.box([0.15, 0.006, 0.08], "screen");
    display.position.set(x, top, 0.12);
    root.add(display);
    // play and cue buttons
    for (const dz of [-0.02, -0.07]) {
        const button = kit.cylinder(0.018, 0.018, 0.008, "metal", 12);
        button.position.set(x - 0.12, top, dz - 0.07);
        root.add(button);
    }
}

export function buildDjTable(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("dj-table");

    const top = kit.box([WIDTH, TOP, DEPTH], "accent", { bevel: 0.006 });
    top.position.y = TABLE_HEIGHT - TOP;
    root.add(top);
    const legHeight = TABLE_HEIGHT - TOP;
    const lx = WIDTH / 2 - LEG;
    const lz = DEPTH / 2 - LEG;
    for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
    ]) {
        const leg = kit.box([LEG, legHeight, LEG], "metal");
        leg.position.set(sx * lx, 0, sz * lz);
        root.add(leg);
    }
    // a cable tray between the legs at the back
    const tray = kit.box([2 * lx, 0.03, 0.15], "metal");
    tray.position.set(0, 0.3, 0);
    root.add(tray);

    const gap = 0.02;
    const offset = MIXER.width / 2 + gap + PLAYER.width / 2;
    player(kit, root, -offset, TABLE_HEIGHT);
    player(kit, root, offset, TABLE_HEIGHT);

    const mixer = kit.box([MIXER.width, MIXER.height, MIXER.depth], "body", { bevel: 0.01 });
    mixer.position.set(0, TABLE_HEIGHT, 0);
    root.add(mixer);
    const mixerTop = TABLE_HEIGHT + MIXER.height;
    // four channel faders and a row of knobs per channel
    for (let i = 0; i < 4; i++) {
        const x = -0.105 + i * 0.07;
        const fader = kit.box([0.012, 0.012, 0.03], "metal");
        fader.position.set(x, mixerTop, -0.11);
        root.add(fader);
        for (let k = 0; k < 3; k++) {
            const knob = kit.cylinder(0.012, 0.012, 0.015, "metal", 12);
            knob.position.set(x, mixerTop, 0.02 + k * 0.05);
            root.add(knob);
        }
    }
    const crossfader = kit.box([0.04, 0.012, 0.012], "metal");
    crossfader.position.set(0, mixerTop, -0.16);
    root.add(crossfader);

    return kit.mergeBySlot(root);
}
