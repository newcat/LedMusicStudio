/**
 * Shared truss section builder for the parametric truss elements (feature 002, T068, research R5).
 * Profiles are 0.29 m wide with chord tubes ⌀ 50 mm and braces ⌀ 20 mm (data-model.md). A section runs along +X
 * from -length/2 to +length/2, is centered on z and its bottom chords touch y = 0.
 */
import type * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";

export type TrussProfile = "flat" | "triangle" | "square";
export const TRUSS_PROFILES: readonly TrussProfile[] = ["flat", "triangle", "square"];

export const TRUSS_WIDTH = 0.29;
export const CHORD_RADIUS = 0.025;
export const BRACE_RADIUS = 0.01;
export const NOMINAL_BAY = 0.5;
const END_PLATE_THICKNESS = 0.01;
const CHORD_OFFSET = TRUSS_WIDTH / 2 - CHORD_RADIUS;

/** Height of a profile: the flat truss lies flat (its chords side by side), the others are 0.29 m high. */
export function trussHeight(profile: TrussProfile): number {
    return profile === "flat" ? 2 * CHORD_RADIUS : TRUSS_WIDTH;
}

/** Chord centers in the y/z plane, in brace order around the profile. */
function chordCenters(profile: TrussProfile): Array<[number, number]> {
    const bottom = CHORD_RADIUS;
    const top = TRUSS_WIDTH - CHORD_RADIUS;
    switch (profile) {
        case "flat":
            return [
                [bottom, -CHORD_OFFSET],
                [bottom, CHORD_OFFSET],
            ];
        case "triangle":
            return [
                [bottom, -CHORD_OFFSET],
                [bottom, CHORD_OFFSET],
                [top, 0],
            ];
        case "square":
            return [
                [bottom, -CHORD_OFFSET],
                [bottom, CHORD_OFFSET],
                [top, CHORD_OFFSET],
                [top, -CHORD_OFFSET],
            ];
    }
}

/** Pairs of chords connected by a braced face. */
function bracedFaces(profile: TrussProfile): Array<[number, number]> {
    const count = chordCenters(profile).length;
    if (count === 2) {
        return [[0, 1]];
    }
    return Array.from({ length: count }, (_, i) => [i, (i + 1) % count] as [number, number]);
}

/** Bay count and length: `n = max(1, round(L / 0.5))`, bay = `L / n` (research R5). */
export function trussBays(length: number): { count: number; bay: number } {
    const count = Math.max(1, Math.round(length / NOMINAL_BAY));
    return { count, bay: length / count };
}

export interface TrussChordLine {
    id: string;
    start: Vec3;
    end: Vec3;
    radius: number;
    /** Bottom chords (y = 0.025) or top chords; both chords of the flat truss are bottom chords. */
    level: "bottom" | "top";
}

/** The chord center lines of a section, used for the mounting areas (US5). */
export function trussChordLines(length: number, profile: TrussProfile): TrussChordLine[] {
    return chordCenters(profile).map(([y, z], i) => ({
        id: `chord-${i + 1}`,
        start: [-length / 2, y, z],
        end: [length / 2, y, z],
        radius: CHORD_RADIUS,
        level: y <= CHORD_RADIUS + 1e-6 ? "bottom" : "top",
    }));
}

/** One truss section, merged per slot (all slot `metal`). */
export function buildTrussSection(kit: BuilderKit, length: number, profile: TrussProfile): THREE.Object3D {
    const root = kit.group(`truss-${profile}`);
    const half = length / 2;
    const chords = chordCenters(profile);

    for (const [y, z] of chords) {
        root.add(kit.tube([-half, y, z], [half, y, z], CHORD_RADIUS, "metal"));
    }

    // zig-zag diagonals per bay on every braced face
    // (the outermost brace ends meet the end plates, so their slanted caps stay inside the length)
    const { count, bay } = trussBays(length);
    const limit = half - END_PLATE_THICKNESS - BRACE_RADIUS;
    const clampX = (x: number) => Math.min(limit, Math.max(-limit, x));
    for (const [a, b] of bracedFaces(profile)) {
        for (let i = 0; i < count; i++) {
            const x0 = clampX(-half + i * bay);
            const x1 = clampX(-half + (i + 1) * bay);
            const [from, to] = i % 2 === 0 ? [chords[a], chords[b]] : [chords[b], chords[a]];
            root.add(kit.tube([x0, from[0], from[1]], [x1, to[0], to[1]], BRACE_RADIUS, "metal"));
        }
    }

    // end plates, inside the length so the section is exactly `length` long
    const height = trussHeight(profile);
    for (const side of [-1, 1]) {
        const plate = kit.box([END_PLATE_THICKNESS, height, TRUSS_WIDTH], "metal");
        plate.position.x = side * (half - END_PLATE_THICKNESS / 2);
        root.add(plate);
    }

    return kit.mergeBySlot(root);
}
