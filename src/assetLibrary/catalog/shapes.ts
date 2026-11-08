/** Basic shapes of the built-in asset library (feature 002, FR-006). They are placed as 001 shape objects. */
import type { ShapeAssetDefinition, ShapeSource } from "../types";
import { PROJECT_CREDITS } from "./credits";

function shape(
    kind: ShapeSource["shape"],
    name: string,
    defaultSize: ShapeAssetDefinition["defaultSize"],
    keywords: string[]
): ShapeAssetDefinition {
    const id = `shape.${kind}`;
    return {
        id,
        name,
        category: "shapes",
        keywords,
        defaultSize,
        preview: `asset-library/previews/${id}.webp`,
        credits: PROJECT_CREDITS,
        source: { type: "shape", shape: kind },
        supportsMaterial: true,
    };
}

export const SHAPE_ASSETS: ShapeAssetDefinition[] = [
    shape("box", "Box", [1, 1, 1], ["box", "cube", "block", "basic"]),
    shape("cylinder", "Cylinder", [1, 1, 1], ["cylinder", "column", "pillar", "round", "basic"]),
    shape("plane", "Plane", [2, 0.01, 2], ["plane", "floor", "surface", "flat", "basic"]),
    shape("sphere", "Sphere", [1, 1, 1], ["sphere", "ball", "globe", "round", "basic"]),
];
