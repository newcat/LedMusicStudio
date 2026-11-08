/** Fixture models of the built-in asset library (feature 002). */
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { buildGenericFixture } from "../builders/fixtures/generic";
import type { Credits, FixtureAssetDefinition } from "../types";

const PROJECT_CREDITS: Credits = {
    author: "LEDMusic Studio contributors",
    source: "LEDMusic Studio",
    license: "GPL-3.0-or-later",
    madeForProject: true,
};

export const FIXTURE_ASSETS: FixtureAssetDefinition[] = [
    {
        id: "fixture.generic",
        name: "Generic fixture",
        category: "fixtures",
        keywords: ["generic", "fixture", "light", "unknown", "fallback"],
        defaultSize: [0.25, 0.3, 0.25],
        preview: "asset-library/previews/fixture.generic.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildGenericFixture },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.GENERIC, VisualizationType.SPOT],
            categories: ["Other", "Effect"],
            beam: { node: "", position: [0, 0.3, 0], direction: [0, 1, 0] },
            lensRadius: 0.08,
            emitters: [{ id: "lens", node: "", shape: "circle", radius: 0.08, position: [0, 0.301, 0], normal: [0, 1, 0] }],
            mountingPoints: [{ id: "base", node: "", position: [0, 0, 0], direction: [0, -1, 0] }],
        },
    },
];
