/**
 * Bake on delete (feature 004, research R10, FR-031): before a preset that looks reference is deleted, every
 * referencing look value is replaced by the preset's values as they were. Common value → `single`; per-fixture
 * values → the look's `perFixture` map. An aim preset becomes an aim value.
 */

import { cloneValue, omitKey, type AttributeKey, type AttributeValue } from "../attributes";
import type { LookLibraryItem } from "../look/Look.libraryItem";
import type { PresetState } from "../states";

export function bakePresetIntoLooks(presetId: string, preset: PresetState, looks: readonly LookLibraryItem[]): void {
    for (const look of looks) {
        const state = look.state;
        for (const key of Object.keys(state.values) as AttributeKey[]) {
            const value = state.values[key];
            if (value?.kind !== "preset" || value.presetId !== presetId) {
                continue;
            }
            if (preset.presetKind === "position" && preset.aimTargetId && key === "pan") {
                state.values.pan = { kind: "aim", aimTargetId: preset.aimTargetId };
                delete state.values.tilt;
                continue;
            }
            for (const [fixtureId, values] of Object.entries(preset.perFixture)) {
                const v = values[key];
                if (v !== undefined) {
                    const own = (state.perFixture[fixtureId] ??= {});
                    // a value the look already has for this fixture stays
                    if ((own as Record<string, unknown>)[key] === undefined) {
                        (own as Record<AttributeKey, AttributeValue>)[key] = cloneValue(key, v);
                    }
                }
            }
            const common = preset.common[key];
            if (common !== undefined) {
                state.values[key] = { kind: "single", value: cloneValue(key, common) };
            } else {
                state.values = omitKey(state.values, key);
            }
        }
    }
}
