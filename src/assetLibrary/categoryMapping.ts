/**
 * Category-based preselection of visualization type and model, and auto-scaling from the fixture dimensions
 * (feature 002, research R13, FR-014, FR-015).
 */
import { VisualizationType } from "@/visualization/fixtureVisualization";
import type { Fixture as OflFixture } from "@/stage/fixtures/dmx/open-fixture";
import { assetCatalog } from "./catalog";
import type { FixtureAssetDefinition, FixturePreselection, OflCategory } from "./types";

type OflMode = OflFixture["modes"][number];

const MIN_DIMENSION_MM = 30;
const MAX_DIMENSION_MM = 3000;
const SCALE_MIN = 0.25;
const SCALE_MAX = 4;
const WASH_LENS_DEGREES = 25;

interface MappingInput {
    name: string;
    lensMaxDegrees: number | undefined;
    pixelCount: number;
}

type CategoryRule = (input: MappingInput) => { type: VisualizationType; modelId: string };

function nameHas(input: MappingInput, ...words: string[]): boolean {
    return words.some((w) => input.name.includes(w));
}

function effectModel(input: MappingInput): string {
    if (nameHas(input, "flame", "fire", "gasprojector")) return "fixture.flame-projector";
    if (nameHas(input, "co2", "cryo")) return "fixture.co2-jet";
    if (nameHas(input, "spark", "sparkular")) return "fixture.cold-spark";
    // light sets on a stand ("GigBAR", "Compact LED Bar") and par-type effects ("COREpar UV"); after "spark", which contains "par"
    if (nameHas(input, "bar")) return "fixture.led-bar";
    if (nameHas(input, "par")) return "fixture.par-can";
    return "fixture.generic";
}

const generic = (modelId: string): CategoryRule => () => ({ type: VisualizationType.GENERIC, modelId });

/** Dedicated effect visualization of the effect models; every other effect model stays Generic. */
const EFFECT_TYPE_BY_MODEL: Record<string, VisualizationType> = {
    "fixture.flame-projector": VisualizationType.FLAME,
    "fixture.co2-jet": VisualizationType.CO2_JET,
    "fixture.cold-spark": VisualizationType.COLD_SPARK,
};

const effect: CategoryRule = (input) => {
    const modelId = effectModel(input);
    return { type: EFFECT_TYPE_BY_MODEL[modelId] ?? VisualizationType.GENERIC, modelId };
};

const RULES: Partial<Record<OflCategory, CategoryRule>> = {
    "Moving Head": (input) => ({
        type: VisualizationType.MOVING_HEAD,
        modelId:
            nameHas(input, "wash") || (input.lensMaxDegrees !== undefined && input.lensMaxDegrees >= WASH_LENS_DEGREES)
                ? "fixture.moving-head-wash"
                : "fixture.moving-head-spot",
    }),
    Scanner: () => ({ type: VisualizationType.MOVING_HEAD, modelId: "fixture.scanner" }),
    "Barrel Scanner": () => ({ type: VisualizationType.MOVING_HEAD, modelId: "fixture.scanner" }),
    "Color Changer": (input) => ({ type: VisualizationType.SPOT, modelId: colorChangerModel(input) }),
    Dimmer: (input) => ({ type: VisualizationType.SPOT, modelId: colorChangerModel(input) }),
    "Pixel Bar": generic("fixture.pixel-bar"),
    Matrix: generic("fixture.led-panel"),
    Strobe: generic("fixture.strobe"),
    Blinder: generic("fixture.blinder"),
    Laser: () => ({ type: VisualizationType.LASER, modelId: "fixture.laser" }),
    Smoke: () => ({ type: VisualizationType.FOG, modelId: "fixture.fog-machine" }),
    Hazer: () => ({ type: VisualizationType.FOG, modelId: "fixture.fog-machine" }),
    Effect: effect,
    Flower: effect,
    Fan: effect,
    Stand: effect,
    Other: effect,
};

function colorChangerModel(input: MappingInput): string {
    if (input.pixelCount > 1 || nameHas(input, "bar", "batten")) return "fixture.led-bar";
    if (nameHas(input, "profile", "ellipsoidal", "leko", "source four")) return "fixture.profile-spot";
    if (nameHas(input, "wash", "fresnel")) return "fixture.wash-fresnel";
    return "fixture.par-can";
}

function physicalOf(definition: OflFixture | null, mode: OflMode | null) {
    return mode?.physical ?? definition?.physical;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The fixture's `[width, height, depth]` in mm if all three are plausible (30 … 3000 mm), otherwise `null`. */
export function plausibleDimensions(definition: OflFixture | null, mode: OflMode | null): [number, number, number] | null {
    const dims = physicalOf(definition, mode)?.dimensions;
    if (!Array.isArray(dims) || dims.length < 3) {
        return null;
    }
    const valid = dims.slice(0, 3).every((d) => typeof d === "number" && Number.isFinite(d) && d >= MIN_DIMENSION_MM && d <= MAX_DIMENSION_MM);
    return valid ? [dims[0], dims[1], dims[2]] : null;
}

/** `clamp(median(dim_i / 1000 / defaultSize_i), 0.25, 4)`, or 1 without plausible dimensions (research R13). */
export function modelScaleFor(model: FixtureAssetDefinition, definition: OflFixture | null, mode: OflMode | null): number {
    const dims = plausibleDimensions(definition, mode);
    if (!dims) {
        return 1;
    }
    const ratios = dims.map((d, i) => d / 1000 / Math.max(model.defaultSize[i], 0.01));
    const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, median(ratios)));
    return Math.round(scale * 1000) / 1000;
}

/** Visualization type, model and model scale for an OFL fixture (research R13). */
export function preselectForFixture(definition: OflFixture | null, mode: OflMode | null): FixturePreselection {
    let type = VisualizationType.GENERIC;
    let modelId = "fixture.generic";
    if (definition) {
        const physical = physicalOf(definition, mode);
        const input: MappingInput = {
            name: (definition.name ?? "").toLowerCase(),
            lensMaxDegrees: physical?.lens?.degreesMinMax?.[1],
            pixelCount: (definition.matrix?.pixelCount ?? [1]).reduce((p, c) => p * c, 1),
        };
        for (const category of definition.categories ?? []) {
            const rule = RULES[category];
            if (rule) {
                ({ type, modelId } = rule(input));
                break;
            }
        }
    }
    const registered = assetCatalog.get(modelId);
    const model =
        registered?.category === "fixtures" && registered.fixture.visualizationTypes.includes(type) && !assetCatalog.isInvalid(registered.id)
            ? registered
            : assetCatalog.defaultModelFor(type);
    return { visualizationType: type, modelId: model.id, modelScale: modelScaleFor(model, definition, mode) };
}

/** Pan/tilt channel mapping ranges of a new Moving Head config, from the model's physical limits. */
export function defaultChannelRanges(model: FixtureAssetDefinition): { pan?: { min: number; max: number }; tilt?: { min: number; max: number } } {
    const parts = model.fixture.movingParts;
    return {
        pan: parts?.pan ? { min: parts.pan.min, max: parts.pan.max } : undefined,
        tilt: parts?.tilt ? { min: parts.tilt.min, max: parts.tilt.max } : undefined,
    };
}
