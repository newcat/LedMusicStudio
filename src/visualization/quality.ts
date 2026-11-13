import type * as THREE from "three";

export type QualityLevel = "low" | "medium" | "high";
export type ViewKind = "editor" | "show";

export interface QualityProfile {
    level: QualityLevel;
    /** Multiplied with min(devicePixelRatio, pixelRatioCap). */
    pixelRatioScale: number;
    pixelRatioCap: number;
    msaaSamples: 0 | 2 | 4;
    bloomMips: number;
    fullLights: number;
    simpleLights: number;
    shadowLights: number;
    shadowTileSize: 512;
    stripSegments: number;
    beamRadialSegments: number;
    hazeOctaves: number;
    particlesPerEffect: number;
    laserBeamsPerFixture: number;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
    low: {
        level: "low",
        pixelRatioScale: 0.75,
        pixelRatioCap: 1,
        msaaSamples: 0,
        bloomMips: 3,
        fullLights: 6,
        simpleLights: 16,
        shadowLights: 0,
        shadowTileSize: 512,
        stripSegments: 64,
        beamRadialSegments: 24,
        hazeOctaves: 1,
        particlesPerEffect: 128,
        laserBeamsPerFixture: 8,
    },
    medium: {
        level: "medium",
        pixelRatioScale: 1,
        pixelRatioCap: 1.5,
        msaaSamples: 2,
        bloomMips: 5,
        fullLights: 16,
        simpleLights: 48,
        shadowLights: 0,
        shadowTileSize: 512,
        stripSegments: 192,
        beamRadialSegments: 48,
        hazeOctaves: 2,
        particlesPerEffect: 384,
        laserBeamsPerFixture: 16,
    },
    high: {
        level: "high",
        pixelRatioScale: 1,
        pixelRatioCap: 2,
        msaaSamples: 4,
        bloomMips: 5,
        fullLights: 32,
        simpleLights: 96,
        shadowLights: 8,
        shadowTileSize: 512,
        stripSegments: 384,
        beamRadialSegments: 96,
        hazeOctaves: 4,
        particlesPerEffect: 1024,
        laserBeamsPerFixture: 32,
    },
};

/** Device limits checked at view start (research R12, FR-055). */
export interface DeviceSupport {
    floatRenderTargets: boolean;
    maxTextureUnits: number;
    maxTextureSize: number;
}

/** A feature that was downgraded on this device; the HUD shows each notice once per view. */
export interface FallbackNotice {
    feature: "shadows" | "gobos" | "lights" | "msaa" | "bloom";
    message: string;
}

/** Features that a shader or render failure downgrades, one per step, in this order (FR-055, T072). */
export type FallbackFeature = "shadows" | "gobos" | "lights" | "msaa";
export const FALLBACK_ORDER: readonly FallbackFeature[] = ["shadows", "gobos", "lights", "msaa"];

const FEATURE_LABELS: Record<FallbackNotice["feature"], string> = {
    shadows: "Shadows",
    gobos: "Gobo projection",
    lights: "The full light count",
    msaa: "Antialiasing (MSAA)",
    bloom: "HDR bloom",
};

export function fallbackNotice(feature: FallbackNotice["feature"]): FallbackNotice {
    return { feature, message: `${FEATURE_LABELS[feature]} is not supported on this device; a simpler version is used.` };
}

/**
 * The profile with the downgraded features applied: shadows off; gobos off (full lights treated as simple);
 * light count halved; MSAA 0. Positions, colors and beams are unaffected (US6.1).
 */
export function applyFallbacks(profile: QualityProfile, fallbacks: ReadonlySet<FallbackFeature>): QualityProfile {
    if (fallbacks.size === 0) {
        return profile;
    }
    const result: QualityProfile = { ...profile };
    if (fallbacks.has("shadows")) {
        result.shadowLights = 0;
    }
    if (fallbacks.has("gobos")) {
        result.simpleLights += result.fullLights;
        result.fullLights = 0;
    }
    if (fallbacks.has("lights")) {
        result.fullLights = Math.floor(result.fullLights / 2);
        result.simpleLights = Math.max(1, Math.floor(result.simpleLights / 2));
    }
    if (fallbacks.has("msaa")) {
        result.msaaSamples = 0;
    }
    return result;
}

export function detectDeviceSupport(renderer: THREE.WebGLRenderer): DeviceSupport {
    const gl = renderer.getContext();
    return {
        floatRenderTargets: gl.getExtension("EXT_color_buffer_float") !== null,
        maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number,
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    };
}
