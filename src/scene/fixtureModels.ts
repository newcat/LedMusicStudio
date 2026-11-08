/**
 * Model choice for fixture visualizations (feature 002, research R13): preselection from the linked fixture's OFL
 * definition, model scale for a chosen model, and Moving Head channel ranges from the model's limits.
 */
import { assetCatalog } from "@/assetLibrary/catalog";
import { defaultChannelRanges, modelScaleFor, plausibleDimensions, preselectForFixture } from "@/assetLibrary/categoryMapping";
import type { FixtureAssetDefinition, FixturePreselection } from "@/assetLibrary/types";
import { FixtureType, type BaseFixture, type DmxFixture } from "@/stage/fixtures";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import type { FixtureVisualizationModelFields } from "./model/types";

type OflDefinition = DmxFixture["config"]["definition"];
type OflMode = DmxFixture["config"]["mode"];

/** OFL definition and mode of a DMX fixture; `null` for other fixture types or no fixture. */
export function oflOf(fixture: BaseFixture | undefined | null): { definition: OflDefinition; mode: OflMode } | null {
    if (!fixture || fixture.type !== FixtureType.DMX) {
        return null;
    }
    const config = (fixture as DmxFixture).config;
    return { definition: config.definition ?? null, mode: config.mode ?? null };
}

/** Category preselection for a DMX fixture; `null` for other fixture types. */
export function preselectionOf(fixture: BaseFixture | undefined | null): FixturePreselection | null {
    const ofl = oflOf(fixture);
    return ofl ? preselectForFixture(ofl.definition, ofl.mode) : null;
}

/** True if the fixture has plausible dimensions, so models are scaled to it ("Scaled to fixture dimensions"). */
export function hasPlausibleDimensions(fixture: BaseFixture | undefined | null): boolean {
    const ofl = oflOf(fixture);
    return !!ofl && plausibleDimensions(ofl.definition, ofl.mode) !== null;
}

function fixtureModel(modelId: string): FixtureAssetDefinition | undefined {
    const def = assetCatalog.get(modelId);
    return def?.category === "fixtures" ? def : undefined;
}

/** Scale of `modelId` for the fixture's dimensions (1 without plausible dimensions or for unknown models). */
export function modelScaleForFixture(fixture: BaseFixture | undefined | null, modelId: string): number {
    const ofl = oflOf(fixture);
    const model = fixtureModel(modelId);
    return ofl && model ? modelScaleFor(model, ofl.definition, ofl.mode) : 1;
}

/**
 * Model of a new visualization of `type` for `fixture`: the mapped model if the preselection has this type
 * (`strict`) or if the mapped model supports the type (not `strict`), otherwise the type's default at scale 1.
 */
export function modelForType(fixture: BaseFixture | undefined | null, type: VisualizationType, strict: boolean): FixtureVisualizationModelFields {
    const preselection = preselectionOf(fixture);
    if (preselection) {
        const mapped = fixtureModel(preselection.modelId);
        const fits = strict ? preselection.visualizationType === type : !!mapped?.fixture.visualizationTypes.includes(type);
        if (fits) {
            return { modelId: preselection.modelId, modelScale: preselection.modelScale };
        }
    }
    return { modelId: assetCatalog.defaultModelFor(type).id, modelScale: 1 };
}

/** New Moving Head configs take their pan/tilt ranges from the model's physical limits (research R13). */
export function withModelRanges<C>(type: VisualizationType, config: C, modelId: string): C {
    const model = fixtureModel(modelId);
    if (type !== VisualizationType.MOVING_HEAD || !model) {
        return config;
    }
    const ranges = defaultChannelRanges(model);
    const mapping = (config as { channelMapping?: Record<string, unknown> }).channelMapping;
    if (!mapping) {
        return config;
    }
    for (const role of ["pan", "tilt"] as const) {
        const range = ranges[role];
        const channel = mapping[role];
        if (range && channel && typeof channel === "object") {
            mapping[role] = { ...channel, min: range.min, max: range.max };
        }
    }
    return config;
}
