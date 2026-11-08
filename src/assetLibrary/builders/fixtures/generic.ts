/**
 * fixture.generic: the fallback body for unknown or invalid fixture models (feature 002).
 * A dark rounded box on a short bracket with a round lens face on top; standing, lens pointing +Y.
 */
import type * as THREE from "three";
import type { BuilderKit } from "../../types";

const BODY = { width: 0.25, height: 0.217, depth: 0.25 };
const BRACKET_HEIGHT = 0.08;
const BEZEL_RADIUS = 0.095;
const LENS_RADIUS = 0.08;

export function buildGenericFixture(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("generic");

    // base plate and stem
    root.add(kit.box([0.18, 0.015, 0.18], "metal", { bevel: 0.004 }));
    const stem = kit.cylinder(0.03, 0.035, BRACKET_HEIGHT - 0.015, "metal", 16);
    stem.position.y = 0.015;
    root.add(stem);

    // housing
    const body = kit.box([BODY.width, BODY.height, BODY.depth], "body", { bevel: 0.015 });
    body.position.y = BRACKET_HEIGHT;
    root.add(body);

    // lens face: bezel ring and glass, flush with the total height of 0.3 m
    const top = BRACKET_HEIGHT + BODY.height;
    const bezel = kit.cylinder(BEZEL_RADIUS, BEZEL_RADIUS, 0.002, "accent", 24);
    bezel.position.y = top;
    root.add(bezel);
    const glass = kit.cylinder(LENS_RADIUS, LENS_RADIUS, 0.001, "glass", 24);
    glass.position.y = top + 0.002;
    root.add(glass);

    return kit.mergeBySlot(root);
}
