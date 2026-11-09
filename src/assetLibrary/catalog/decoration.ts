/** Decoration assets of the built-in asset library (feature 002). */
import { buildAmp } from "../builders/decoration/amp";
import { buildBarCounter } from "../builders/decoration/barCounter";
import { buildChair } from "../builders/decoration/chair";
import { buildDjBooth } from "../builders/decoration/djBooth";
import { buildDjTable } from "../builders/decoration/djTable";
import { buildDrumKit } from "../builders/decoration/drumKit";
import { buildFigureArmsUp, buildFigureStanding } from "../builders/decoration/figure";
import { buildKeyboardStand } from "../builders/decoration/keyboardStand";
import { buildLineArray } from "../builders/decoration/lineArray";
import { buildMicStand } from "../builders/decoration/micStand";
import { buildMonitorWedge } from "../builders/decoration/monitorWedge";
import { buildSpeakerStack } from "../builders/decoration/speakerStack";
import { buildTable } from "../builders/decoration/table";
import type { ColorVariant, DecorationAssetDefinition } from "../types";
import { PROJECT_CREDITS } from "./credits";

const WOOD = { body: "#8a5a35", accent: "#6b4429" };

const FURNITURE_VARIANTS: ColorVariant[] = [
    { id: "wood", name: "Wood", slots: WOOD },
    { id: "black", name: "Black", slots: { body: "#151515", accent: "#222222" } },
];

const SPEAKER_VARIANTS: ColorVariant[] = [
    { id: "black", name: "Black", slots: { body: "#141414", accent: "#262626" } },
    { id: "white", name: "White", slots: { body: "#e6e6e6", accent: "#3a3a3a" } },
];

/** Neutral light grey for the mannequins; the "Grey" variant is a darker grey. */
const FIGURE_DEFAULT = { body: "#b4b4b4" };
const FIGURE_VARIANTS: ColorVariant[] = [{ id: "grey", name: "Grey", slots: { body: "#6f6f6f" } }];

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
        defaultColors: WOOD,
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
        defaultColors: WOOD,
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
        variants: SPEAKER_VARIANTS,
    },
    {
        id: "decoration.line-array",
        name: "Line array (hanging)",
        category: "decoration",
        keywords: ["line array", "pa", "speaker", "hanging", "sound", "loudspeaker"],
        defaultSize: [0.7, 1.6, 0.5],
        preview: "asset-library/previews/decoration.line-array.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildLineArray },
        materialSlots: ["body", "accent", "metal"],
        variants: SPEAKER_VARIANTS,
    },
    {
        id: "decoration.monitor-wedge",
        name: "Stage monitor (wedge)",
        category: "decoration",
        keywords: ["monitor", "wedge", "foldback", "speaker"],
        defaultSize: [0.55, 0.35, 0.45],
        preview: "asset-library/previews/decoration.monitor-wedge.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildMonitorWedge },
        materialSlots: ["body", "accent", "metal"],
        variants: [{ id: "black", name: "Black", slots: { body: "#141414", accent: "#262626" } }],
    },
    {
        id: "decoration.dj-booth",
        name: "DJ booth",
        category: "decoration",
        keywords: ["dj booth", "booth", "dj", "riser", "facade"],
        defaultSize: [2.0, 1.1, 0.8],
        preview: "asset-library/previews/decoration.dj-booth.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildDjBooth },
        materialSlots: ["body", "accent", "metal"],
        variants: [
            { id: "black", name: "Black", slots: { body: "#151515", accent: "#2a2a2a" } },
            { id: "white", name: "White", slots: { body: "#ececec", accent: "#bdbdbd" } },
        ],
    },
    {
        id: "decoration.dj-table",
        name: "DJ table with decks",
        category: "decoration",
        keywords: ["dj", "decks", "turntable", "cdj", "mixer", "table"],
        defaultSize: [1.2, 0.95, 0.6],
        preview: "asset-library/previews/decoration.dj-table.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildDjTable },
        materialSlots: ["body", "accent", "metal", "screen"],
        defaultColors: { screen: "#2b5d8f" },
        variants: [{ id: "black", name: "Black", slots: { body: "#111111", accent: "#1e1e1e" } }],
    },
    {
        id: "decoration.drum-kit",
        name: "Drum kit",
        category: "decoration",
        keywords: ["drums", "drum kit", "band", "percussion"],
        defaultSize: [2.0, 1.3, 1.6],
        preview: "asset-library/previews/decoration.drum-kit.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildDrumKit },
        materialSlots: ["body", "accent", "metal"],
        defaultColors: { body: "#1f3a66", accent: "#e8e4d8" },
        variants: [
            { id: "black", name: "Black", slots: { body: "#141414" } },
            { id: "red", name: "Red", slots: { body: "#8f1d1d" } },
        ],
    },
    {
        id: "decoration.amp",
        name: "Guitar/bass amplifier",
        category: "decoration",
        keywords: ["amp", "amplifier", "guitar", "bass", "cabinet", "stack"],
        defaultSize: [0.75, 1.3, 0.4],
        preview: "asset-library/previews/decoration.amp.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildAmp },
        materialSlots: ["body", "accent", "metal"],
        defaultColors: { accent: "#4a463e" },
        variants: [{ id: "black", name: "Black", slots: { body: "#141414", accent: "#262626" } }],
    },
    {
        id: "decoration.keyboard-stand",
        name: "Keyboard on stand",
        category: "decoration",
        keywords: ["keyboard", "piano", "synth", "stand"],
        defaultSize: [1.3, 0.95, 0.45],
        preview: "asset-library/previews/decoration.keyboard-stand.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildKeyboardStand },
        materialSlots: ["body", "accent", "metal"],
        defaultColors: { accent: "#f2f2ee", body: "#151515" },
    },
    {
        id: "decoration.mic-stand",
        name: "Microphone stand",
        category: "decoration",
        keywords: ["mic", "microphone", "stand", "vocal"],
        defaultSize: [0.5, 1.6, 0.5],
        preview: "asset-library/previews/decoration.mic-stand.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildMicStand },
        materialSlots: ["body", "metal"],
    },
    {
        id: "decoration.bar-counter",
        name: "Bar counter",
        category: "decoration",
        keywords: ["bar", "counter", "drinks", "furniture"],
        defaultSize: [3.0, 1.1, 0.7],
        preview: "asset-library/previews/decoration.bar-counter.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildBarCounter },
        materialSlots: ["body", "accent", "metal"],
        defaultColors: { body: "#8a5a35", accent: "#4a2f1c" },
        variants: [
            { id: "wood", name: "Wood", slots: { body: "#8a5a35", accent: "#4a2f1c" } },
            { id: "black", name: "Black", slots: { body: "#151515", accent: "#2a2a2a" } },
        ],
    },
    {
        id: "decoration.figure-standing",
        name: "Human figure (standing)",
        category: "decoration",
        keywords: ["human", "person", "figure", "people", "scale", "audience"],
        defaultSize: [0.5, 1.78, 0.3],
        preview: "asset-library/previews/decoration.figure-standing.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildFigureStanding },
        materialSlots: ["body"],
        defaultColors: FIGURE_DEFAULT,
        variants: FIGURE_VARIANTS,
    },
    {
        id: "decoration.figure-arms-up",
        name: "Human figure (arms raised)",
        category: "decoration",
        keywords: ["human", "person", "figure", "crowd", "party", "arms up"],
        defaultSize: [0.6, 2.15, 0.3],
        preview: "asset-library/previews/decoration.figure-arms-up.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildFigureArmsUp },
        materialSlots: ["body"],
        defaultColors: FIGURE_DEFAULT,
        variants: FIGURE_VARIANTS,
    },
];
