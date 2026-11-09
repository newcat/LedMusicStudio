/**
 * stage.platform: a stage deck on square legs (feature 002, T072). The deck (slot `body`, takes the material
 * preset) is `min(0.1, height)` thick with its top at `height`; legs (slot `metal`) stand at the corners and on a
 * grid at most 2 m apart. Centered on x/z, bottom at y = 0.
 */
import type * as THREE from "three";
import { numberParam } from "../../params";
import type { BuilderKit, ParamValues, Vec3 } from "../../types";

const MAX_DECK_THICKNESS = 0.1;
const LEG = 0.06;
const MAX_LEG_SPACING = 2;

function dimensions(p: ParamValues) {
    return { width: numberParam(p, "width", 2), depth: numberParam(p, "depth", 1), height: numberParam(p, "height", 0.6) };
}

export function platformSize(p: ParamValues): Vec3 {
    const { width, depth, height } = dimensions(p);
    return [width, height, depth];
}

/** `ceil(extent / 2) + 1` leg positions, evenly spaced, the outer ones flush with the deck edge. */
function legPositions(extent: number): number[] {
    const count = Math.ceil(extent / MAX_LEG_SPACING) + 1;
    const span = extent - LEG;
    return Array.from({ length: count }, (_, i) => -span / 2 + (span * i) / (count - 1));
}

export function buildPlatform(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    const { width, depth, height } = dimensions(p);
    const root = kit.group("platform");

    const thickness = Math.min(MAX_DECK_THICKNESS, height);
    const deck = kit.box([width, thickness, depth], "body");
    deck.position.y = height - thickness;
    root.add(deck);

    const legHeight = height - thickness;
    if (legHeight > 0.001) {
        for (const x of legPositions(width)) {
            for (const z of legPositions(depth)) {
                const leg = kit.box([LEG, legHeight, LEG], "metal");
                leg.position.set(x, 0, z);
                root.add(leg);
            }
        }
    }

    return kit.mergeBySlot(root);
}
