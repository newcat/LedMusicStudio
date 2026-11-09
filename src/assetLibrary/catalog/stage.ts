/**
 * Stage elements of the built-in asset library (feature 002, US4). All are parametric (research R5); ranges and
 * defaults follow data-model.md → "Parametric element parameters", `defaultSize = size(defaults)`.
 */
import { buildBackdrop, backdropSize } from "../builders/stage/backdrop";
import { buildFloor, floorSize } from "../builders/stage/floor";
import { buildPlatform, platformSize } from "../builders/stage/platform";
import { buildStairs, stairsSize } from "../builders/stage/stairs";
import {
    buildTrussCorner,
    buildTrussStraight,
    buildTrussTower,
    CORNER_LEG,
    CORNER_REACH,
    TOWER_TOP_BLOCK,
    trussCornerSize,
    trussStraightSize,
    trussTowerSize,
} from "../builders/stage/truss";
import { TRUSS_PROFILES, TRUSS_WIDTH, trussChordLines, trussHeight, type TrussProfile } from "../builders/stage/trussCommon";
import { buildWall, wallSize } from "../builders/stage/wall";
import { choiceParam, defaultParams, numberParam } from "../params";
import type { BuilderKit, ConnectionPoint, MountingArea, MountMode, ParamSpec, ParamValues, StageAssetDefinition, Vec3 } from "../types";
import type * as THREE from "three";
import { PROJECT_CREDITS } from "./credits";

function meters(key: string, label: string, min: number, max: number, defaultValue: number): ParamSpec {
    return { key, label, type: "number", min, max, step: 0.01, unit: "m", default: defaultValue };
}

const TRUSS_PROFILE: ParamSpec = {
    key: "profile",
    label: "Profile",
    type: "choice",
    options: [
        { value: "flat", label: "Flat (2 chords)" },
        { value: "triangle", label: "Triangle (3 chords)" },
        { value: "square", label: "Square (4 chords)" },
    ],
    default: "square",
};

interface StageElement {
    id: string;
    name: string;
    keywords: string[];
    params: ParamSpec[];
    size: (p: ParamValues) => Vec3;
    build: (p: ParamValues, kit: BuilderKit) => THREE.Object3D;
    materialSlots: string[];
    mountingAreas?: (p: ParamValues) => MountingArea[];
    connections?: (p: ParamValues) => ConnectionPoint[];
}

// ---------------------------------------------------------------------------------------------------------------
// Mounting areas and connection points (feature 002, US5, research R8)
// ---------------------------------------------------------------------------------------------------------------

function profileOf(p: ParamValues): TrussProfile {
    return choiceParam(p, "profile", TRUSS_PROFILES, "square");
}

function connectionType(profile: TrussProfile): string {
    return `truss.${profile}-290`;
}

const UP: Vec3 = [0, 1, 0];

/** Bottom chords carry hanging fixtures, top chords standing ones; both chords of the flat truss allow both. */
function chordModes(profile: TrussProfile, level: "bottom" | "top"): MountMode[] {
    if (profile === "flat") {
        return ["hang", "stand"];
    }
    return level === "bottom" ? ["hang"] : ["stand"];
}

/** The chords of a section of `length` along +X, centered on the origin, mapped by `map`. */
function chordAreas(length: number, profile: TrussProfile, prefix: string, map: (v: Vec3) => Vec3): MountingArea[] {
    return trussChordLines(length, profile).map((chord) => ({
        id: `${prefix}${chord.id}`,
        type: "line",
        start: map(chord.start),
        end: map(chord.end),
        radius: chord.radius,
        modes: chordModes(profile, chord.level),
    }));
}

function trussStraightAreas(p: ParamValues): MountingArea[] {
    return chordAreas(numberParam(p, "length", 2), profileOf(p), "", (v) => v);
}

function trussStraightConnections(p: ParamValues): ConnectionPoint[] {
    const length = numberParam(p, "length", 2);
    const profile = profileOf(p);
    const y = trussHeight(profile) / 2;
    return [
        { id: "end-a", position: [-length / 2, y, 0], direction: [-1, 0, 0], up: UP, type: connectionType(profile) },
        { id: "end-b", position: [length / 2, y, 0], direction: [1, 0, 0], up: UP, type: connectionType(profile) },
    ];
}

/** Leg centers of the corner (see buildTrussCorner: leg X along +X, leg Z rotated by -90° about Y). */
const CORNER_LEG_CENTER = TRUSS_WIDTH / 2 + CORNER_LEG / 2;

function trussCornerAreas(p: ParamValues): MountingArea[] {
    const profile = profileOf(p);
    return [
        ...chordAreas(CORNER_LEG, profile, "x-", ([x, y, z]) => [x + CORNER_LEG_CENTER, y, z]),
        // Ry(-90°) maps (x, y, z) to (-z, y, x)
        ...chordAreas(CORNER_LEG, profile, "z-", ([x, y, z]) => [-z, y, x + CORNER_LEG_CENTER]),
    ];
}

function trussCornerConnections(p: ParamValues): ConnectionPoint[] {
    const profile = profileOf(p);
    const y = trussHeight(profile) / 2;
    return [
        { id: "end-x", position: [CORNER_REACH, y, 0], direction: [1, 0, 0], up: UP, type: connectionType(profile) },
        { id: "end-z", position: [0, y, CORNER_REACH], direction: [0, 0, 1], up: UP, type: connectionType(profile) },
    ];
}

/** Four points in the middle of the side faces of the top block. */
function trussTowerConnections(p: ParamValues): ConnectionPoint[] {
    const y = numberParam(p, "height", 3) - TOWER_TOP_BLOCK / 2;
    const h = TOWER_TOP_BLOCK / 2;
    const type = connectionType("square");
    return [
        { id: "side-px", position: [h, y, 0], direction: [1, 0, 0], up: UP, type },
        { id: "side-nx", position: [-h, y, 0], direction: [-1, 0, 0], up: UP, type },
        { id: "side-pz", position: [0, y, h], direction: [0, 0, 1], up: UP, type },
        { id: "side-nz", position: [0, y, -h], direction: [0, 0, -1], up: UP, type },
    ];
}

function platformAreas(p: ParamValues): MountingArea[] {
    const width = numberParam(p, "width", 2);
    const depth = numberParam(p, "depth", 1);
    const height = numberParam(p, "height", 0.6);
    return [{ id: "top", type: "surface", center: [0, height, 0], size: [width, depth], normal: [0, 1, 0], modes: ["stand"] }];
}

function stageElement(e: StageElement): StageAssetDefinition {
    return {
        id: e.id,
        name: e.name,
        category: "stage",
        keywords: e.keywords,
        defaultSize: e.size(defaultParams(e.params)),
        preview: `asset-library/previews/${e.id}.webp`,
        credits: PROJECT_CREDITS,
        source: {
            type: "parametric",
            params: e.params,
            size: e.size,
            build: e.build,
            ...(e.mountingAreas ? { mountingAreas: e.mountingAreas } : {}),
            ...(e.connections ? { connections: e.connections } : {}),
        },
        materialSlots: e.materialSlots,
        supportsMaterial: true,
    };
}

export const STAGE_ASSETS: StageAssetDefinition[] = [
    stageElement({
        id: "stage.platform",
        name: "Stage platform / riser",
        keywords: ["stage", "platform", "riser", "podium", "deck"],
        params: [meters("width", "Width", 0.5, 20, 2), meters("depth", "Depth", 0.5, 20, 1), meters("height", "Height", 0.1, 3, 0.6)],
        size: platformSize,
        build: buildPlatform,
        materialSlots: ["body", "metal"],
        mountingAreas: platformAreas,
    }),
    stageElement({
        id: "stage.stairs",
        name: "Stairs",
        keywords: ["stairs", "steps", "staircase", "access"],
        params: [meters("width", "Width", 0.5, 5, 1), meters("height", "Height", 0.15, 3, 0.6)],
        size: stairsSize,
        build: buildStairs,
        materialSlots: ["body", "metal"],
    }),
    stageElement({
        id: "stage.truss-straight",
        name: "Truss (straight)",
        keywords: ["truss", "rigging", "beam", "straight"],
        params: [meters("length", "Length", 0.25, 30, 2), TRUSS_PROFILE],
        size: trussStraightSize,
        build: buildTrussStraight,
        materialSlots: ["body", "metal"],
        mountingAreas: trussStraightAreas,
        connections: trussStraightConnections,
    }),
    stageElement({
        id: "stage.truss-corner",
        name: "Truss corner",
        keywords: ["truss", "corner", "rigging", "90"],
        params: [TRUSS_PROFILE],
        size: trussCornerSize,
        build: buildTrussCorner,
        materialSlots: ["body", "metal"],
        mountingAreas: trussCornerAreas,
        connections: trussCornerConnections,
    }),
    stageElement({
        id: "stage.truss-tower",
        name: "Truss tower",
        keywords: ["truss", "tower", "goalpost", "upright", "stand"],
        params: [meters("height", "Height", 1, 8, 3)],
        size: trussTowerSize,
        build: buildTrussTower,
        materialSlots: ["body", "metal"],
        // no mounting areas: the top block carries the connection points
        connections: trussTowerConnections,
    }),
    stageElement({
        id: "stage.backdrop",
        name: "Backdrop / curtain",
        keywords: ["backdrop", "curtain", "drape", "background", "molton"],
        params: [
            meters("width", "Width", 0.5, 30, 6),
            meters("height", "Height", 0.5, 15, 4),
            {
                key: "style",
                label: "Style",
                type: "choice",
                options: [
                    { value: "curtain", label: "Curtain" },
                    { value: "flat", label: "Flat panel" },
                ],
                default: "curtain",
            },
        ],
        size: backdropSize,
        build: buildBackdrop,
        materialSlots: ["body", "metal"],
    }),
    stageElement({
        id: "stage.wall",
        name: "Wall",
        keywords: ["wall", "room", "partition"],
        params: [meters("width", "Width", 0.1, 50, 4), meters("height", "Height", 0.1, 15, 3), meters("thickness", "Thickness", 0.05, 1, 0.2)],
        size: wallSize,
        build: buildWall,
        materialSlots: ["body"],
    }),
    stageElement({
        id: "stage.floor",
        name: "Floor area",
        keywords: ["floor", "ground", "dance floor", "area"],
        params: [meters("width", "Width", 0.5, 100, 10), meters("depth", "Depth", 0.5, 100, 10)],
        size: floorSize,
        build: buildFloor,
        materialSlots: ["body"],
    }),
];
