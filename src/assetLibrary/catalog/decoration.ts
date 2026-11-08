/** Decoration assets of the built-in asset library (feature 002). */
import { buildChair } from "../builders/decoration/chair";
import { buildSpeakerStack } from "../builders/decoration/speakerStack";
import { buildTable } from "../builders/decoration/table";
import type { ColorVariant, DecorationAssetDefinition } from "../types";
import { PROJECT_CREDITS } from "./credits";

const FURNITURE_VARIANTS: ColorVariant[] = [
    { id: "wood", name: "Wood", slots: { body: "#8a5a35", accent: "#6b4429" } },
    { id: "black", name: "Black", slots: { body: "#151515", accent: "#222222" } },
];

export const DECORATION_ASSETS: DecorationAssetDefinition[] = [
    {
        id: "decoration.table",
        name: "Table",
        category: "decoration",
        keywords: ["table", "desk", "furniture"],
        defaultSize: [1.2, 0.75, 0.8],
        preview: "asset-library/previews/decoration.table.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildTable },
        materialSlots: ["body", "accent"],
        variants: FURNITURE_VARIANTS,
    },
    {
        id: "decoration.chair",
        name: "Chair",
        category: "decoration",
        keywords: ["chair", "seat", "furniture"],
        defaultSize: [0.45, 0.85, 0.5],
        preview: "asset-library/previews/decoration.chair.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildChair },
        materialSlots: ["body", "accent"],
        variants: FURNITURE_VARIANTS,
    },
    {
        id: "decoration.speaker-stack",
        name: "Speaker stack",
        category: "decoration",
        keywords: ["speaker", "pa", "loudspeaker", "box", "sound", "stack"],
        defaultSize: [0.6, 1.8, 0.6],
        preview: "asset-library/previews/decoration.speaker-stack.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildSpeakerStack },
        materialSlots: ["body", "accent", "metal"],
        variants: [
            { id: "black", name: "Black", slots: { body: "#141414", accent: "#262626" } },
            { id: "white", name: "White", slots: { body: "#e6e6e6", accent: "#3a3a3a" } },
        ],
    },
];
