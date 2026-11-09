/**
 * Stage elements of the built-in asset library (feature 002, US4). All are parametric (research R5); ranges and
 * defaults follow data-model.md → "Parametric element parameters", `defaultSize = size(defaults)`.
 */
import { buildBackdrop, backdropSize } from "../builders/stage/backdrop";
import { buildFloor, floorSize } from "../builders/stage/floor";
import { buildPlatform, platformSize } from "../builders/stage/platform";
import { buildStairs, stairsSize } from "../builders/stage/stairs";
import { buildTrussCorner, buildTrussStraight, buildTrussTower, trussCornerSize, trussStraightSize, trussTowerSize } from "../builders/stage/truss";
import { buildWall, wallSize } from "../builders/stage/wall";
import { defaultParams } from "../params";
import type { BuilderKit, ParamSpec, ParamValues, StageAssetDefinition, Vec3 } from "../types";
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
        source: { type: "parametric", params: e.params, size: e.size, build: e.build },
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
    }),
    stageElement({
        id: "stage.truss-corner",
        name: "Truss corner",
        keywords: ["truss", "corner", "rigging", "90"],
        params: [TRUSS_PROFILE],
        size: trussCornerSize,
        build: buildTrussCorner,
        materialSlots: ["body", "metal"],
    }),
    stageElement({
        id: "stage.truss-tower",
        name: "Truss tower",
        keywords: ["truss", "tower", "goalpost", "upright", "stand"],
        params: [meters("height", "Height", 1, 8, 3)],
        size: trussTowerSize,
        build: buildTrussTower,
        materialSlots: ["body", "metal"],
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
