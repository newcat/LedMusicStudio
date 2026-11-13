import { markRaw } from "vue";

import { DmxFixture, FixtureType } from "@/stage/fixtures";
import { FixtureVisualization, VisualizationType } from "../../fixtureVisualization";
import { defaultMappingFor } from "../defaultMapping";
import EffectSettings from "./EffectSettings.vue";
import { defaultEffectOptions, effectKindOf, type EffectVisualizationConfig } from "./types";

/**
 * Visualization definition of an effect type (feature 003, T061): DMX fixtures, a mapping auto-mapped for `type`
 * (`autoMapCapabilities` via `defaultMappingFor`), the kind's default options and `EffectSettings`.
 * Usage: `export const FlameVisualization = createEffectVisualization(VisualizationType.FLAME);`
 */
export function createEffectVisualization(
    type: VisualizationType
): FixtureVisualization<DmxFixture, EffectVisualizationConfig, number[]> {
    const kind = effectKindOf(type);
    if (!kind) {
        throw new Error(`"${type}" is not an effect visualization type`);
    }
    return {
        type,
        compatibleFixtures: [FixtureType.DMX],
        defaultConfig: (fixture, modelId) => ({
            mapping: defaultMappingFor(fixture, type, modelId),
            options: defaultEffectOptions(kind),
        }),
        settingsComponent: markRaw(EffectSettings),
        onFixtureValueUpdate: (value) => ({ value }),
    };
}
