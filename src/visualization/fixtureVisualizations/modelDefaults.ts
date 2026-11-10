/**
 * Config defaults that depend on the fixture model or the OFL definition (feature 003, data-model §2).
 * Shared by the default configs of new objects and by the load rules of old projects (sanitize).
 */
import type { Fixture as OflFixture } from "@/stage/fixtures/dmx/open-fixture";

type OflMode = OflFixture["modes"][number];

/** Beam edge softness by model id: profile 0.1, spot / moving-head spot 0.25, par 0.4, wash/fresnel 0.7. */
export function beamSoftnessFor(modelId: string): number {
    if (modelId.includes("profile")) {
        return 0.1;
    }
    if (modelId.includes("wash") || modelId.includes("fresnel")) {
        return 0.7;
    }
    if (modelId.includes("par")) {
        return 0.4;
    }
    return 0.25;
}

const SURFACE_LIGHT_MODELS = new Set(["fixture.strobe", "fixture.blinder", "fixture.led-bar", "fixture.pixel-bar", "fixture.led-panel"]);

/** Generic Fixture: strobes, blinders, LED/pixel bars and LED panels light surfaces by default. */
export function genericSurfaceLightFor(modelId: string): boolean {
    return SURFACE_LIGHT_MODELS.has(modelId);
}

/** Generic Fixture light cone angle: blinder 90, strobe 120, bars/panels 60, else 90. */
export function genericLightAngleFor(modelId: string): number {
    switch (modelId) {
        case "fixture.strobe":
            return 120;
        case "fixture.led-bar":
        case "fixture.pixel-bar":
        case "fixture.led-panel":
            return 60;
        default:
            return 90;
    }
}

/** Default beam angle when zoom is unmapped: the OFL lens minimum angle, else 15°. */
export function defaultBeamAngleFor(definition: OflFixture | null | undefined, mode: OflMode | null | undefined): number {
    const lens = mode?.physical?.lens ?? definition?.physical?.lens;
    const min = lens?.degreesMinMax?.[0];
    return typeof min === "number" && Number.isFinite(min) && min > 0 ? Math.min(120, Math.max(1, min)) : 15;
}
