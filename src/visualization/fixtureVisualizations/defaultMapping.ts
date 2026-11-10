/**
 * Capability mapping of a new DMX visualization config (feature 003, T039): auto-mapped from the fixture's OFL
 * definition and mode, with the model's limits as fallback ranges; empty without definition or mode.
 */
import { assetCatalog } from "@/assetLibrary/catalog";
import type { FixtureAssetDefinition } from "@/assetLibrary/types";
import type { DmxFixture } from "@/stage/fixtures";
import type { VisualizationType } from "../fixtureVisualization";
import { autoMapCapabilities } from "../capabilities/autoMap";
import { emptyMapping, type CapabilityMapping } from "../capabilities/types";

/** Fixture model of `modelId`, or null for unknown ids and non-fixture assets. */
export function fixtureModelOf(modelId: string | undefined): FixtureAssetDefinition | null {
    const definition = modelId !== undefined ? assetCatalog.get(modelId) : undefined;
    return definition?.category === "fixtures" ? definition : null;
}

export function defaultMappingFor(fixture: DmxFixture | undefined, type: VisualizationType, modelId?: string): CapabilityMapping {
    const definition = fixture?.config.definition;
    const mode = fixture?.config.mode;
    return definition && mode ? autoMapCapabilities(definition, mode, type, fixtureModelOf(modelId)) : emptyMapping();
}
