/**
 * stage.backdrop: backdrop / curtain (feature 002, T074). Style "curtain" is a vertical surface with sinusoidal
 * folds along X (fold spacing `width / max(1, round(width / 0.2))`, depth amplitude 0.05 m) hanging from a top pipe
 * ⌀ 50 mm (slot `metal`); style "flat" is a 0.02 m thick panel. The fabric is slot `body`, so material presets
 * apply. Centered on x and z, front facing +Z, bottom at y = 0.
 */
import * as THREE from "three";
import { choiceParam, numberParam } from "../../params";
import type { BuilderKit, ParamValues, Vec3 } from "../../types";

export type BackdropStyle = "curtain" | "flat";
export const BACKDROP_STYLES: readonly BackdropStyle[] = ["curtain", "flat"];

const NOMINAL_FOLD = 0.2;
const FOLD_AMPLITUDE = 0.05;
const SEGMENTS_PER_FOLD = 8;
const PIPE_RADIUS = 0.025;
const PANEL_THICKNESS = 0.02;

function dimensions(p: ParamValues) {
    return {
        width: numberParam(p, "width", 6),
        height: numberParam(p, "height", 4),
        style: choiceParam(p, "style", BACKDROP_STYLES, "curtain"),
    };
}

export function backdropSize(p: ParamValues): Vec3 {
    const { width, height, style } = dimensions(p);
    return [width, height, style === "curtain" ? 2 * FOLD_AMPLITUDE : PANEL_THICKNESS];
}

/**
 * The folded fabric from y = 0 to `height`: a strip of quads along X, z = A·sin(2πx / fold). Both sides are
 * modelled (front and back faces share their vertices' positions), so the curtain is visible from behind too.
 */
function curtainGeometry(width: number, height: number): THREE.BufferGeometry {
    const folds = Math.max(1, Math.round(width / NOMINAL_FOLD));
    const columns = folds * SEGMENTS_PER_FOLD;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    for (const side of [1, -1]) {
        for (let i = 0; i <= columns; i++) {
            const t = i / columns;
            const phase = (i / SEGMENTS_PER_FOLD) * Math.PI * 2;
            const x = -width / 2 + t * width;
            const z = FOLD_AMPLITUDE * Math.sin(phase);
            // dz/dx = A · 2π/fold · cos(phase); the normal is (-dz/dx, 0, 1), normalized
            const slope = FOLD_AMPLITUDE * ((Math.PI * 2) / (width / folds)) * Math.cos(phase);
            const length = Math.hypot(slope, 1);
            for (const y of [0, height]) {
                positions.push(x, y, z);
                normals.push((side * -slope) / length, 0, side / length);
                uvs.push(t, y / height);
            }
        }
    }
    const indices: number[] = [];
    const perSide = (columns + 1) * 2;
    for (let i = 0; i < columns; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        // front: counter-clockwise seen from +Z
        indices.push(a, c, b, b, c, d);
        // back: same quad from the back copy, reversed winding
        indices.push(perSide + a, perSide + b, perSide + c, perSide + b, perSide + d, perSide + c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
}

export function buildBackdrop(p: ParamValues, kit: BuilderKit): THREE.Object3D {
    const { width, height, style } = dimensions(p);
    const root = kit.group("backdrop");

    if (style === "flat") {
        root.add(kit.box([width, height, PANEL_THICKNESS], "body"));
        return kit.mergeBySlot(root);
    }

    const pipeY = height - PIPE_RADIUS;
    const fabric = new THREE.Mesh(curtainGeometry(width, pipeY), new THREE.MeshStandardMaterial());
    fabric.userData.slot = "body";
    root.add(fabric);
    root.add(kit.tube([-width / 2, pipeY, 0], [width / 2, pipeY, 0], PIPE_RADIUS, "metal"));

    return kit.mergeBySlot(root);
}
