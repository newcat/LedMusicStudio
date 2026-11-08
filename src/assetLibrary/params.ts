/**
 * Parameter completion and size computation for parametric assets (feature 002, data-model invariant 3).
 */
import type { AssetDefinition, ParamValues, Vec3 } from "./types";

const MIN_SIZE = 0.01;

function roundToStep(value: number, min: number, step: number): number {
    if (!(step > 0)) {
        return value;
    }
    const rounded = min + Math.round((value - min) / step) * step;
    return Number(rounded.toFixed(10));
}

/** Every ParamSpec key, clamped and rounded; unknown keys are dropped. `{}` for non-parametric sources. */
export function completeParams(definition: AssetDefinition, raw: Partial<ParamValues> | null | undefined): ParamValues {
    if (definition.source.type !== "parametric") {
        return {};
    }
    const result: ParamValues = {};
    for (const spec of definition.source.params) {
        const value = raw?.[spec.key];
        if (spec.type === "number") {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                result[spec.key] = spec.default;
                continue;
            }
            const stepped = roundToStep(Math.min(spec.max, Math.max(spec.min, value)), spec.min, spec.step);
            result[spec.key] = Math.min(spec.max, Math.max(spec.min, stepped));
        } else {
            result[spec.key] = typeof value === "string" && spec.options.some((o) => o.value === value) ? value : spec.default;
        }
    }
    return result;
}

/** Bounding box size W×H×D; each component ≥ 0.01. */
export function sizeOf(definition: AssetDefinition, params: Partial<ParamValues> | null | undefined): Vec3 {
    const size = definition.source.type === "parametric" ? definition.source.size(completeParams(definition, params)) : definition.defaultSize;
    return [Math.max(MIN_SIZE, size[0]), Math.max(MIN_SIZE, size[1]), Math.max(MIN_SIZE, size[2])];
}
