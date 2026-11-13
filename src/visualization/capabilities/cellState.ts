/**
 * Multi-cell fixture decoding (feature 003, FR-034, contracts/renderer-api.ts `CellState`): raw DMX values +
 * cell mapping → per-emitter linear RGB. Pure per-frame logic: no Vue/Pinia imports.
 */

import * as THREE from "three";
import { ADDITIVE_PRIMARIES } from "./colorMath";
import { readDmx } from "./decode";
import type { CapabilityChannel, CapabilityMapping, CellMapping } from "./types";

export interface CellState {
    /** RGB triplets (linear, × intensity) in emitter order of the model description. */
    colors: Float32Array;
    /** Average color × intensity for the surface light. */
    average: THREE.Color;
    intensity: number;
}

/** Color channels of a cell, with the additive primary each one contributes. */
const CELL_COLOR_KEYS = ["red", "green", "blue", "white", "amber", "uv"] as const satisfies ReadonlyArray<
    keyof CellMapping & keyof typeof ADDITIVE_PRIMARIES
>;

const CELL_EMITTER_PREFIX = "cell-";

/** Cell channels are plain 8-bit indices: a 0..1 value, or null when unmapped / out of range. */
function cellValue(index: number, values: Uint8Array): number | null {
    const entry: CapabilityChannel = { channel: index, fine: -1, segments: [], defaultValue: 0, source: "auto" };
    const raw = readDmx(entry, values);
    return raw === null ? null : raw / 255;
}

/** Linear RGB of one pixel before the fixture intensity: additive mix × cell dimmer. */
function pixelColor(cell: CellMapping, values: Uint8Array, fixtureColor: THREE.Color): THREE.Color {
    const out = new THREE.Color().setRGB(0, 0, 0, THREE.LinearSRGBColorSpace);
    let anyColor = false;
    for (const key of CELL_COLOR_KEYS) {
        const v = cellValue(cell[key], values);
        if (v === null) {
            continue;
        }
        anyColor = true;
        const p = ADDITIVE_PRIMARIES[key];
        out.r += p.r * v;
        out.g += p.g * v;
        out.b += p.b * v;
    }
    if (!anyColor) {
        out.copy(fixtureColor);
    }
    // Missing dimmer = fixture dimmer only (applied through `intensity`).
    return out.multiplyScalar(cellValue(cell.dimmer, values) ?? 1);
}

/**
 * Decodes the cells of a multi-cell fixture into one color per emitter.
 * - More pixels than emitters: each emitter shows the average of its pixels.
 * - Fewer pixels than emitters: the remaining emitters copy the nearest pixel.
 * - No `cell-*` emitters in the model: every emitter shows the average.
 * - No cells in the mapping: every pixel is the fixture color.
 * Emitters that are not `cell-*` always receive the average.
 */
export function decodeCells(
    mapping: CapabilityMapping,
    values: Uint8Array,
    emitterIds: readonly string[],
    fixtureColor: THREE.Color,
    intensity: number
): CellState {
    const pixels =
        mapping.cells.length > 0
            ? mapping.cells.map((cell) => pixelColor(cell, values, fixtureColor))
            : [fixtureColor.clone()];

    const rawAverage = new THREE.Color().setRGB(0, 0, 0, THREE.LinearSRGBColorSpace);
    for (const p of pixels) {
        rawAverage.r += p.r;
        rawAverage.g += p.g;
        rawAverage.b += p.b;
    }
    rawAverage.multiplyScalar(1 / pixels.length);
    const average = rawAverage.clone().multiplyScalar(intensity);

    const colors = new Float32Array(emitterIds.length * 3);
    // `c` is pre-intensity; the fixture intensity is applied here, once.
    const writeEmitter = (emitter: number, c: THREE.Color): void => {
        colors[emitter * 3] = c.r * intensity;
        colors[emitter * 3 + 1] = c.g * intensity;
        colors[emitter * 3 + 2] = c.b * intensity;
    };

    const targets: number[] = [];
    emitterIds.forEach((id, i) => {
        if (id.startsWith(CELL_EMITTER_PREFIX)) {
            targets.push(i);
        }
    });

    // Default: every emitter shows the average (also non-cell emitters and models without cells).
    for (let i = 0; i < emitterIds.length; i++) {
        writeEmitter(i, rawAverage);
    }

    const pixelCount = pixels.length;
    const emitterCount = targets.length;
    targets.forEach((emitterIndex, e) => {
        if (pixelCount >= emitterCount) {
            const from = Math.floor((e * pixelCount) / emitterCount);
            const to = Math.max(from + 1, Math.floor(((e + 1) * pixelCount) / emitterCount));
            const mean = new THREE.Color().setRGB(0, 0, 0, THREE.LinearSRGBColorSpace);
            for (let p = from; p < to; p++) {
                mean.r += pixels[p].r;
                mean.g += pixels[p].g;
                mean.b += pixels[p].b;
            }
            writeEmitter(emitterIndex, mean.multiplyScalar(1 / (to - from)));
        } else {
            writeEmitter(emitterIndex, pixels[Math.floor((e * pixelCount) / emitterCount)]);
        }
    });

    return { colors, average, intensity };
}
