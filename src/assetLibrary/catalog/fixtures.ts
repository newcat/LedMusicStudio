/** Fixture models of the built-in asset library (feature 002). */
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { buildGenericFixture } from "../builders/fixtures/generic";
import { buildLedProfile, ledProfileSize, LED_PROFILE_HEIGHT, LED_PROFILE_WIDTH } from "../builders/fixtures/ledProfile";
import { buildMovingHeadBeam } from "../builders/fixtures/movingHeadBeam";
import { buildMovingHeadSpot } from "../builders/fixtures/movingHeadSpot";
import { buildMovingHeadWash, washCellPosition, WASH_CELL_CENTERS, WASH_CELL_RADIUS, WASH_PLATE_Y } from "../builders/fixtures/movingHeadWash";
import { buildParCan } from "../builders/fixtures/parCan";
import type { Emitter, FixtureAssetDefinition, FixtureModelDescription, MountingPoint } from "../types";
import { PROJECT_CREDITS } from "./credits";

const BASE_MOUNT: MountingPoint = { id: "base", node: "", position: [0, 0, 0], direction: [0, -1, 0] };

/** Pan/tilt limits shared by the moving head models. */
const MOVING_HEAD_PARTS: FixtureModelDescription["movingParts"] = {
    pan: { node: "pan", axis: "y", min: -270, max: 270 },
    tilt: { node: "tilt", axis: "x", min: -135, max: 135 },
};

/** A moving head description with the beam and one round lens emitter on the tilt node at height `lensY`. */
function movingHead(lensY: number, lensRadius: number, extraEmitters: Emitter[] = []): FixtureModelDescription {
    return {
        visualizationTypes: [VisualizationType.MOVING_HEAD],
        categories: ["Moving Head"],
        movingParts: MOVING_HEAD_PARTS,
        beam: { node: "tilt", position: [0, lensY, 0], direction: [0, 1, 0] },
        lensRadius,
        emitters: [
            { id: "lens", node: "tilt", shape: "circle", radius: lensRadius, position: [0, lensY + 0.001, 0], normal: [0, 1, 0] },
            ...extraEmitters,
        ],
        mountingPoints: [BASE_MOUNT],
    };
}

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
            mountingPoints: [BASE_MOUNT],
        },
    },
    {
        id: "fixture.moving-head-spot",
        name: "Moving head (spot/beam)",
        category: "fixtures",
        keywords: ["moving head", "spot", "beam", "mover", "intelligent"],
        defaultSize: [0.35, 0.6, 0.3],
        preview: "asset-library/previews/fixture.moving-head-spot.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildMovingHeadSpot },
        materialSlots: ["body", "accent", "glass"],
        fixture: movingHead(0.24, 0.06),
    },
    {
        id: "fixture.moving-head-beam",
        name: "Moving head (beam)",
        category: "fixtures",
        keywords: ["moving head", "beam", "sharpy", "mover"],
        defaultSize: [0.3, 0.5, 0.25],
        preview: "asset-library/previews/fixture.moving-head-beam.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildMovingHeadBeam },
        materialSlots: ["body", "accent", "glass"],
        fixture: movingHead(0.18, 0.035),
    },
    {
        id: "fixture.moving-head-wash",
        name: "Moving head (wash)",
        category: "fixtures",
        keywords: ["moving head", "wash", "led", "mover"],
        defaultSize: [0.4, 0.55, 0.35],
        preview: "asset-library/previews/fixture.moving-head-wash.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildMovingHeadWash },
        materialSlots: ["body", "accent", "glass"],
        fixture: movingHead(
            WASH_PLATE_Y,
            0.13,
            WASH_CELL_CENTERS.map(
                (_, i): Emitter => ({ id: `cell-${i + 1}`, node: "tilt", shape: "circle", radius: WASH_CELL_RADIUS, position: washCellPosition(i), normal: [0, 1, 0] }),
            ),
        ),
    },
    {
        id: "fixture.par-can",
        name: "Par can",
        category: "fixtures",
        keywords: ["par", "par can", "spot", "light", "can"],
        defaultSize: [0.25, 0.35, 0.25],
        preview: "asset-library/previews/fixture.par-can.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildParCan },
        materialSlots: ["body", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.SPOT, VisualizationType.GENERIC],
            categories: ["Color Changer", "Dimmer"],
            beam: { node: "", position: [0, 0.35, 0], direction: [0, 1, 0] },
            lensRadius: 0.09,
            emitters: [{ id: "lens", node: "", shape: "circle", radius: 0.09, position: [0, 0.351, 0], normal: [0, 1, 0] }],
            mountingPoints: [BASE_MOUNT],
        },
    },
    {
        id: "fixture.led-profile",
        name: "LED strip profile",
        category: "fixtures",
        keywords: ["led", "strip", "profile", "aluminium", "channel", "tape"],
        defaultSize: [1, LED_PROFILE_HEIGHT, LED_PROFILE_WIDTH],
        preview: "asset-library/previews/fixture.led-profile.webp",
        credits: PROJECT_CREDITS,
        source: {
            type: "parametric",
            params: [{ key: "length", label: "Length", type: "number", min: 0.05, max: 50, step: 0.01, unit: "m", default: 1 }],
            size: ledProfileSize,
            build: buildLedProfile,
        },
        materialSlots: ["metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.LED_STRIP],
            categories: ["Pixel Bar"],
            lensRadius: 0.008,
            emitters: [{ id: "strip", node: "", shape: "rect", size: [1, 0.012], position: [0, LED_PROFILE_HEIGHT + 0.001, 0], normal: [0, 1, 0], up: [0, 0, -1] }],
            mountingPoints: [{ id: "back", node: "", position: [0, 0, 0], direction: [0, -1, 0] }],
            ledStrip: { profileWidth: LED_PROFILE_WIDTH, profileHeight: LED_PROFILE_HEIGHT },
        },
    },
];
