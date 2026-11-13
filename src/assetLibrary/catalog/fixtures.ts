/** Fixture models of the built-in asset library (feature 002). */
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { buildGenericFixture } from "../builders/fixtures/generic";
import { buildLedProfile, ledProfileSize, LED_PROFILE_HEIGHT, LED_PROFILE_WIDTH } from "../builders/fixtures/ledProfile";
import { buildMovingHeadBeam } from "../builders/fixtures/movingHeadBeam";
import { buildMovingHeadSpot } from "../builders/fixtures/movingHeadSpot";
import { buildMovingHeadWash, washCellPosition, WASH_CELL_CENTERS, WASH_CELL_RADIUS, WASH_PLATE_Y } from "../builders/fixtures/movingHeadWash";
import { buildParCan } from "../builders/fixtures/parCan";
import { BLINDER_CELL_RADIUS, blinderCellPosition, buildBlinder } from "../builders/fixtures/blinder";
import { buildCo2Jet, CO2_NOZZLE_RADIUS, CO2_NOZZLE_Y } from "../builders/fixtures/co2Jet";
import { buildColdSpark, COLD_SPARK_OUTLET_RADIUS, COLD_SPARK_OUTLET_Y } from "../builders/fixtures/coldSpark";
import { buildFlameProjector, FLAME_NOZZLE_RADIUS, FLAME_NOZZLE_Y } from "../builders/fixtures/flameProjector";
import { buildFogMachine, FOG_NOZZLE_RADIUS, FOG_NOZZLE_Y, FOG_NOZZLE_Z } from "../builders/fixtures/fogMachine";
import { buildLaser, LASER_APERTURE_Y, LASER_FRONT_Z } from "../builders/fixtures/laser";
import { buildLedBar, LED_BAR_CELL_SIZE, LED_BAR_CELLS, LED_BAR_FRONT_Y, ledBarCellPosition } from "../builders/fixtures/ledBar";
import { buildLedPanel, LED_PANEL_CELL_SIZE, LED_PANEL_GRID, ledPanelCellPosition } from "../builders/fixtures/ledPanel";
import { buildPixelBar, PIXEL_BAR_CELL_SIZE, PIXEL_BAR_CELLS, pixelBarCellPosition } from "../builders/fixtures/pixelBar";
import { buildProfileSpot, PROFILE_LENS_RADIUS, PROFILE_LENS_Y } from "../builders/fixtures/profileSpot";
import { buildScanner, SCANNER_MIRROR_SURFACE } from "../builders/fixtures/scanner";
import { buildStrobe, STROBE_WINDOW_Y } from "../builders/fixtures/strobe";
import { buildWashFresnel, FRESNEL_LENS_RADIUS, FRESNEL_LENS_Y } from "../builders/fixtures/washFresnel";
import type { Emitter, FixtureAssetDefinition, FixtureModelDescription, MountingPoint, Vec3 } from "../types";
import { PROJECT_CREDITS } from "./credits";

const BASE_MOUNT: MountingPoint = { id: "base", node: "", position: [0, 0, 0], direction: [0, -1, 0] };
/** Bar-shaped and bracket fixtures mount at the center of their bracket strap. */
const BRACKET_MOUNT: MountingPoint = { id: "bracket", node: "", position: [0, 0, 0], direction: [0, -1, 0] };

const UP: Vec3 = [0, 1, 0];
/** `up` of rect emitters that face +Y: the far side (−Z) is the top when the front is turned to the audience. */
const FACE_UP_TOP: Vec3 = [0, 0, -1];

/** A round emitter on the model root. */
function circleEmitter(id: string, position: Vec3, radius: number, normal: Vec3 = UP): Emitter {
    return { id, node: "", shape: "circle", radius, position, normal };
}

/** A rectangular emitter on the model root facing +Y. */
function rectEmitter(id: string, position: Vec3, size: [number, number]): Emitter {
    return { id, node: "", shape: "rect", size, position, normal: UP, up: FACE_UP_TOP };
}

/** Effect with a dedicated visualization and one round nozzle emitter facing +Y; the beam leaves the nozzle along +Y. */
function nozzleEffect(
    visualization: VisualizationType,
    categories: FixtureModelDescription["categories"],
    nozzleY: number,
    radius: number,
): FixtureModelDescription {
    return {
        visualizationTypes: [visualization, VisualizationType.GENERIC],
        categories,
        beam: { node: "", position: [0, nozzleY, 0], direction: [0, 1, 0] },
        lensRadius: radius,
        emitters: [circleEmitter("nozzle", [0, nozzleY + 0.001, 0], radius)],
        mountingPoints: [BASE_MOUNT],
    };
}

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
        id: "fixture.wash-fresnel",
        name: "Wash (Fresnel)",
        category: "fixtures",
        keywords: ["wash", "fresnel", "pc", "soft light"],
        defaultSize: [0.31, 0.4, 0.31],
        preview: "asset-library/previews/fixture.wash-fresnel.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildWashFresnel },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.SPOT, VisualizationType.GENERIC],
            categories: ["Dimmer", "Color Changer"],
            beam: { node: "", position: [0, FRESNEL_LENS_Y, 0], direction: [0, 1, 0] },
            lensRadius: FRESNEL_LENS_RADIUS,
            emitters: [circleEmitter("lens", [0, FRESNEL_LENS_Y + 0.001, 0], FRESNEL_LENS_RADIUS)],
            mountingPoints: [BASE_MOUNT],
        },
    },
    {
        id: "fixture.profile-spot",
        name: "Profile spot (ellipsoidal)",
        category: "fixtures",
        keywords: ["profile", "ellipsoidal", "leko", "source four", "spot"],
        defaultSize: [0.25, 0.7, 0.4],
        preview: "asset-library/previews/fixture.profile-spot.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildProfileSpot },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.SPOT, VisualizationType.GENERIC],
            categories: ["Dimmer"],
            beam: { node: "", position: [0, PROFILE_LENS_Y, 0], direction: [0, 1, 0] },
            lensRadius: PROFILE_LENS_RADIUS,
            emitters: [circleEmitter("lens", [0, PROFILE_LENS_Y + 0.001, 0], PROFILE_LENS_RADIUS)],
            mountingPoints: [BASE_MOUNT],
        },
    },
    {
        id: "fixture.scanner",
        name: "Scanner",
        category: "fixtures",
        keywords: ["scanner", "mirror", "barrel"],
        defaultSize: [0.25, 0.5, 0.25],
        preview: "asset-library/previews/fixture.scanner.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildScanner },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.MOVING_HEAD],
            categories: ["Scanner", "Barrel Scanner"],
            movingParts: {
                pan: { node: "pan", axis: "y", min: -90, max: 90 },
                tilt: { node: "tilt", axis: "x", min: -45, max: 45 },
            },
            beam: { node: "tilt", position: [0, SCANNER_MIRROR_SURFACE, 0], direction: [0, 1, 0] },
            lensRadius: 0.03,
            emitters: [{ id: "aperture", node: "tilt", shape: "circle", radius: 0.03, position: [0, SCANNER_MIRROR_SURFACE + 0.001, 0], normal: UP }],
            mountingPoints: [BASE_MOUNT],
        },
    },
    {
        id: "fixture.strobe",
        name: "Strobe",
        category: "fixtures",
        keywords: ["strobe", "flash", "atomic"],
        defaultSize: [0.54, 0.2, 0.2],
        preview: "asset-library/previews/fixture.strobe.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildStrobe },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.GENERIC],
            categories: ["Strobe"],
            lensRadius: 0.04,
            emitters: [rectEmitter("tube", [0, STROBE_WINDOW_Y + 0.001, 0], [0.42, 0.08])],
            mountingPoints: [BRACKET_MOUNT],
        },
    },
    {
        id: "fixture.blinder",
        name: "Blinder (4 cells)",
        category: "fixtures",
        keywords: ["blinder", "audience", "molefay", "dwe"],
        defaultSize: [0.54, 0.25, 0.5],
        preview: "asset-library/previews/fixture.blinder.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildBlinder },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.GENERIC],
            categories: ["Blinder"],
            lensRadius: BLINDER_CELL_RADIUS,
            emitters: [0, 1, 2, 3].map((i) => circleEmitter(`cell-${i + 1}`, blinderCellPosition(i), BLINDER_CELL_RADIUS)),
            mountingPoints: [BRACKET_MOUNT],
        },
    },
    {
        id: "fixture.led-bar",
        name: "LED bar / batten",
        category: "fixtures",
        keywords: ["led bar", "batten", "wash bar", "bar"],
        defaultSize: [1, 0.1, 0.1],
        preview: "asset-library/previews/fixture.led-bar.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildLedBar },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.GENERIC, VisualizationType.SPOT],
            categories: ["Color Changer", "Pixel Bar"],
            beam: { node: "", position: [0, LED_BAR_FRONT_Y + 0.001, 0], direction: [0, 1, 0] },
            lensRadius: 0.04,
            emitters: Array.from({ length: LED_BAR_CELLS }, (_, i) => rectEmitter(`cell-${i + 1}`, ledBarCellPosition(i), LED_BAR_CELL_SIZE)),
            mountingPoints: [BRACKET_MOUNT],
        },
    },
    {
        id: "fixture.pixel-bar",
        name: "Pixel bar",
        category: "fixtures",
        keywords: ["pixel bar", "pixel", "led tube", "bar"],
        defaultSize: [1, 0.06, 0.06],
        preview: "asset-library/previews/fixture.pixel-bar.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildPixelBar },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.GENERIC],
            categories: ["Pixel Bar"],
            lensRadius: 0.02,
            emitters: Array.from({ length: PIXEL_BAR_CELLS }, (_, i) => rectEmitter(`cell-${i + 1}`, pixelBarCellPosition(i), PIXEL_BAR_CELL_SIZE)),
            mountingPoints: [BRACKET_MOUNT],
        },
    },
    {
        id: "fixture.led-panel",
        name: "LED panel",
        category: "fixtures",
        keywords: ["led panel", "matrix", "video wall", "tile", "screen"],
        defaultSize: [0.5, 0.56, 0.2],
        preview: "asset-library/previews/fixture.led-panel.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildLedPanel },
        materialSlots: ["body", "metal", "screen"],
        fixture: {
            visualizationTypes: [VisualizationType.GENERIC],
            categories: ["Matrix"],
            lensRadius: LED_PANEL_CELL_SIZE / 2,
            emitters: Array.from({ length: LED_PANEL_GRID * LED_PANEL_GRID }, (_, i): Emitter => {
                const row = Math.floor(i / LED_PANEL_GRID) + 1;
                const col = (i % LED_PANEL_GRID) + 1;
                return {
                    id: `cell-${row}-${col}`,
                    node: "",
                    shape: "rect",
                    size: [LED_PANEL_CELL_SIZE, LED_PANEL_CELL_SIZE],
                    position: ledPanelCellPosition(row, col),
                    normal: [0, 0, 1],
                    up: UP,
                };
            }),
            mountingPoints: [BASE_MOUNT],
        },
    },
    {
        id: "fixture.laser",
        name: "Laser",
        category: "fixtures",
        keywords: ["laser", "beam", "show laser"],
        defaultSize: [0.25, 0.15, 0.32],
        preview: "asset-library/previews/fixture.laser.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildLaser },
        materialSlots: ["body", "accent", "metal", "glass"],
        // The rest beam points +Z by design: lasers are placed level. This is an exception to research R3, allowed
        // because only Generic Fixture is declared, which does not use the beam (the +Y rule covers Moving Head and Spot).
        fixture: {
            visualizationTypes: [VisualizationType.LASER, VisualizationType.GENERIC],
            categories: ["Laser"],
            beam: { node: "", position: [0, LASER_APERTURE_Y, LASER_FRONT_Z], direction: [0, 0, 1] },
            lensRadius: 0.03,
            emitters: [
                { id: "aperture", node: "", shape: "rect", size: [0.06, 0.03], position: [0, LASER_APERTURE_Y, LASER_FRONT_Z + 0.001], normal: [0, 0, 1], up: UP },
            ],
            mountingPoints: [BASE_MOUNT],
        },
    },
    {
        id: "fixture.flame-projector",
        name: "Flame projector",
        category: "fixtures",
        keywords: ["flame", "fire", "flame projector", "pyro"],
        defaultSize: [0.3, 0.4, 0.3],
        preview: "asset-library/previews/fixture.flame-projector.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildFlameProjector },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: nozzleEffect(VisualizationType.FLAME, ["Effect"], FLAME_NOZZLE_Y, FLAME_NOZZLE_RADIUS),
    },
    {
        id: "fixture.co2-jet",
        name: "CO2 jet",
        category: "fixtures",
        keywords: ["co2", "cryo", "jet", "cannon"],
        defaultSize: [0.2, 0.4, 0.2],
        preview: "asset-library/previews/fixture.co2-jet.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildCo2Jet },
        materialSlots: ["body", "accent", "metal"],
        fixture: nozzleEffect(VisualizationType.CO2_JET, ["Effect", "Smoke"], CO2_NOZZLE_Y, CO2_NOZZLE_RADIUS),
    },
    {
        id: "fixture.cold-spark",
        name: "Cold spark machine",
        category: "fixtures",
        keywords: ["cold spark", "sparkular", "spark", "fountain"],
        defaultSize: [0.35, 0.25, 0.35],
        preview: "asset-library/previews/fixture.cold-spark.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildColdSpark },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: nozzleEffect(VisualizationType.COLD_SPARK, ["Effect"], COLD_SPARK_OUTLET_Y, COLD_SPARK_OUTLET_RADIUS),
    },
    {
        id: "fixture.fog-machine",
        name: "Fog machine / hazer",
        category: "fixtures",
        keywords: ["fog", "smoke", "hazer", "haze", "fogger"],
        defaultSize: [0.5, 0.25, 0.25],
        preview: "asset-library/previews/fixture.fog-machine.webp",
        credits: PROJECT_CREDITS,
        source: { type: "procedural", build: buildFogMachine },
        materialSlots: ["body", "accent", "metal", "glass"],
        fixture: {
            visualizationTypes: [VisualizationType.FOG, VisualizationType.GENERIC],
            categories: ["Smoke", "Hazer"],
            beam: { node: "", position: [0, FOG_NOZZLE_Y, FOG_NOZZLE_Z], direction: [0, 0, 1] },
            lensRadius: FOG_NOZZLE_RADIUS,
            emitters: [circleEmitter("nozzle", [0, FOG_NOZZLE_Y, FOG_NOZZLE_Z + 0.001], FOG_NOZZLE_RADIUS, [0, 0, 1])],
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
