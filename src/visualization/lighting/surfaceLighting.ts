import * as THREE from "three";

import { detectDeviceSupport, QUALITY_PROFILES, type FallbackNotice, type QualityProfile } from "../quality";
import { CanvasGoboAtlas } from "./goboAtlas";
import { assignTiers, OMNI_ANGLE, type LightTier, type PrioritizedLight } from "./lightPriority";
import { MAX_SHADOW_LIGHTS, MIN_TEXTURE_UNITS_FOR_SHADOWS, ShadowAtlas, type ShadowLight } from "./shadowAtlas";

/**
 * All light that fixtures throw onto surfaces, one instance per view (feature 003, research R7/R10). Lights and
 * LED strip segments are packed into float textures that every LED-lit material of the view shares
 * (`createLedLitMaterial`); the fragment chunk `shaders/surfaceLighting.frag` loops over them.
 */

export type LightHandle = number & { readonly __light: unique symbol };
export type StripHandle = number & { readonly __strip: unique symbol };

export interface SpotLightParams {
    type: "spot";
    /** World space. */
    position: THREE.Vector3;
    direction: THREE.Vector3;
    /** Linear RGB × intensity (may exceed 1). */
    color: THREE.Color;
    /** Full beam angle, degrees. */
    angle: number;
    /** 0 = hard edge, 1 = very soft. */
    softness: number;
    /** meters; light ends here (beam length / first hit + margin). */
    range: number;
    /** Gobo atlas tile from GoboAtlas.acquire, or −1. */
    goboTile: number;
    /** radians */
    goboRotation: number;
    /** 0 = no prism; 3..8 */
    prismFacets: number;
    prismRotation: number;
    prismSpread: number;
    /**
     * World point the beam center mainly lights (first hit of the center ray), used for the light priority.
     * Defaults to `position + direction · range`.
     */
    litPoint?: THREE.Vector3;
}

export interface OmniLightParams {
    type: "omni";
    position: THREE.Vector3;
    color: THREE.Color;
    range: number;
}

export interface StripSegmentsSource {
    /** World-space pixel positions and normals (xyz per pixel) and 0..255 RGB per pixel, same length/3. */
    readonly worldPositions: Float32Array;
    readonly worldNormals: Float32Array;
    readonly colors: Uint8Array;
    readonly visible: boolean;
}

export type { GoboAtlas } from "./goboAtlas";

/** Texels per light / per segment in the data textures. */
const LIGHT_TEXELS = 4;
const SEGMENT_TEXELS = 3;
/** Target length of a strip segment in meters (research R10). */
const SEGMENT_LENGTH = 0.5;
/** Lights darker than this (luminance of color × intensity) are skipped. */
const MIN_LIGHT = 1e-4;
/** Overflow lights are summed into `uOverflowLight` with this factor (research R7). */
const OVERFLOW_FACTOR = 0.02;
/**
 * Texel 3.x of a light packs the gobo tile (−1..63) and the shadow tile (−1..7):
 * `goboTile + SHADOW_TILE_STRIDE · (shadowTile + 1)`; decoded in surfaceLighting.frag.
 */
export const SHADOW_TILE_STRIDE = 128;

function createDataTexture(width: number, height: number): THREE.DataTexture {
    const texture = new THREE.DataTexture(new Float32Array(width * height * 4), width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

function createPlaceholderTexture(): THREE.DataTexture {
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

/** Normal (−1..1 per axis) quantized to 8 bit per axis and packed into one float (exact up to 2^24). */
function packNormal(x: number, y: number, z: number): number {
    const q = (v: number) => Math.round((Math.min(1, Math.max(-1, v)) * 0.5 + 0.5) * 255);
    return q(x) * 65536 + q(y) * 256 + q(z);
}

interface LightRecord {
    /** null until the first setLight. */
    data: Float32Array | null;
    type: "spot" | "omni";
    /** Full beam angle in degrees (spot). */
    angle: number;
    /** Input of the light priority; color and litPoint are updated by setLight. */
    priority: PrioritizedLight<number> & { color: THREE.Color; angle: number };
}

/** Shadow tile of a light: index into the atlas and its view-projection matrix (uniform `uShadowTiles[tile]`). */
export interface ShadowTile {
    tile: number;
    matrix: THREE.Matrix4;
}

interface StripRecord {
    source: StripSegmentsSource;
    /** Per frame: pixel count, segment count after LOD, distance to the camera. */
    pixels: number;
    segments: number;
    distance: number;
}

export class SurfaceLighting {
    /** Shared by every LED-lit material of the view (createLedLitMaterial). */
    public readonly uniforms: {
        uLightCount: { value: number };
        uLightData: { value: THREE.DataTexture };
        uSegmentCount: { value: number };
        uSegmentData: { value: THREE.DataTexture };
        uGoboAtlas: { value: THREE.Texture };
        uAmbientColor: { value: THREE.Color };
        uOverflowLight: { value: THREE.Color };
        uShadowAtlas: { value: THREE.Texture };
        /** View-projection matrix per shadow tile (MAX_SHADOW_LIGHTS); the tile index is in texel 3 of the light. */
        uShadowTiles: { value: THREE.Matrix4[] };
    };
    /** Receives fallback notices (shadows unavailable); set by the view. */
    public onNotice: ((notice: FallbackNotice) => void) | null = null;
    /**
     * Compile-time sizes of the light loops (they change only with the quality level) and the device fallbacks
     * (`setFallbacks`, FR-055); a define with the value `false` is left out by three.js.
     */
    public readonly defines: { MAX_LIGHTS: number; MAX_SEGMENTS: number; SL_NO_SHADOWS: boolean; SL_NO_GOBOS: boolean };
    public readonly gobos: CanvasGoboAtlas;

    private readonly shadowPlaceholder = createPlaceholderTexture();
    private readonly lights = new Map<number, LightRecord>();
    private readonly strips = new Map<number, StripRecord>();
    private readonly materials = new Set<THREE.Material>();
    private nextHandle = 1;
    private lightTexture: THREE.DataTexture;
    private segmentTexture: THREE.DataTexture;
    private disposed = false;

    /** Tiers of the previous frame (hysteresis). */
    private tiers = new Map<number, LightTier>();
    private readonly activeLights: Array<PrioritizedLight<number> & { color: THREE.Color; angle: number }> = [];
    private readonly overflow = new THREE.Color();
    private shadowAtlas: ShadowAtlas<number> | null = null;
    /** Set once shadows turned out to be unavailable on this device. */
    private shadowsUnavailable = false;
    /** Light handle → shadow tile of the current frame. */
    private shadowTiles: ReadonlyMap<number, number> = new Map();
    private readonly shadowLights: Array<ShadowLight<number>> = [];
    private readonly unusedShadowMatrices = Array.from({ length: MAX_SHADOW_LIGHTS }, () => new THREE.Matrix4());

    private readonly cameraPosition = new THREE.Vector3();
    private readonly tmp = new THREE.Vector3();

    public constructor(quality: QualityProfile = QUALITY_PROFILES.medium) {
        this.defines = {
            MAX_LIGHTS: quality.fullLights + quality.simpleLights,
            MAX_SEGMENTS: quality.stripSegments,
            SL_NO_SHADOWS: false,
            SL_NO_GOBOS: false,
        };
        this.lightTexture = createDataTexture(LIGHT_TEXELS, this.defines.MAX_LIGHTS);
        this.segmentTexture = createDataTexture(SEGMENT_TEXELS, this.defines.MAX_SEGMENTS);
        this.gobos = new CanvasGoboAtlas();
        this.uniforms = {
            uLightCount: { value: 0 },
            uLightData: { value: this.lightTexture },
            uSegmentCount: { value: 0 },
            uSegmentData: { value: this.segmentTexture },
            uGoboAtlas: { value: this.gobos.texture },
            uAmbientColor: { value: new THREE.Color(0, 0, 0) },
            uOverflowLight: { value: new THREE.Color(0, 0, 0) },
            uShadowAtlas: { value: this.shadowPlaceholder },
            uShadowTiles: { value: this.unusedShadowMatrices },
        };
    }

    /** The shadow depth atlas (a 1×1 placeholder while shadows are off). */
    public get shadowAtlasTexture(): THREE.Texture {
        return this.uniforms.uShadowAtlas.value;
    }

    /**
     * The shadow tile of a light in the current frame, or null when it has none. Valid after `update`, so beams read
     * it while rendering (e.g. in `onBeforeRender`).
     */
    public getShadowTile(handle: LightHandle): ShadowTile | null {
        const tile = this.shadowTiles.get(handle);
        if (tile === undefined || !this.shadowAtlas) {
            return null;
        }
        return { tile, matrix: this.shadowAtlas.matrices[tile] };
    }

    // -----------------------------------------------------------------------------------------------------------
    // Materials

    /**
     * Adds the defines to the material and keeps them in sync with the quality level. The defines are merged into
     * the material's own `defines` (MeshPhysicalMaterial needs its STANDARD/PHYSICAL defines).
     */
    public registerMaterial(material: THREE.Material) {
        material.defines = Object.assign(material.defines ?? {}, this.defines);
        if (this.materials.has(material)) {
            return;
        }
        this.materials.add(material);
        const onDispose = () => {
            this.materials.delete(material);
            material.removeEventListener("dispose", onDispose);
        };
        material.addEventListener("dispose", onDispose);
    }

    // -----------------------------------------------------------------------------------------------------------
    // Lights

    public addLight(): LightHandle {
        const handle = this.nextHandle++;
        this.lights.set(handle, {
            data: null,
            type: "spot",
            angle: 0,
            priority: { key: handle, color: new THREE.Color(0, 0, 0), angle: 0, litPoint: new THREE.Vector3(), score: 0 },
        });
        return handle as LightHandle;
    }

    /** Called by renderers in update(); a black color (intensity 0) means off this frame. */
    public setLight(handle: LightHandle, params: SpotLightParams | OmniLightParams) {
        const record = this.lights.get(handle);
        if (!record) {
            return;
        }
        const d = (record.data ??= new Float32Array(LIGHT_TEXELS * 4));
        d[0] = params.position.x;
        d[1] = params.position.y;
        d[2] = params.position.z;
        d[3] = Math.max(0, params.range);
        d[8] = params.color.r;
        d[9] = params.color.g;
        d[10] = params.color.b;
        if (params.type === "spot") {
            const dir = params.direction;
            const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
            d[4] = dir.x / len;
            d[5] = dir.y / len;
            d[6] = dir.z / len;
            d[7] = Math.cos(THREE.MathUtils.degToRad(Math.min(179, Math.max(0.1, params.angle))) / 2);
            d[11] = Math.min(1, Math.max(0, params.softness));
            d[12] = params.goboTile;
            d[13] = params.goboRotation;
            d[14] = params.prismFacets + params.prismSpread / 100;
            d[15] = params.prismRotation;
            record.type = "spot";
            record.angle = params.angle;
            record.priority.angle = params.angle;
            if (params.litPoint) {
                record.priority.litPoint.copy(params.litPoint);
            } else {
                record.priority.litPoint.set(d[4], d[5], d[6]).multiplyScalar(d[3]).add(params.position);
            }
        } else {
            d[4] = 0;
            d[5] = 0;
            d[6] = 0;
            d[7] = -2;
            d[11] = 0;
            d[12] = -1;
            d[13] = 0;
            d[14] = 0;
            d[15] = 0;
            record.type = "omni";
            record.angle = OMNI_ANGLE;
            record.priority.angle = OMNI_ANGLE;
            record.priority.litPoint.copy(params.position);
        }
        record.priority.color.copy(params.color);
    }

    public removeLight(handle: LightHandle) {
        this.lights.delete(handle);
        this.tiers.delete(handle);
    }

    // -----------------------------------------------------------------------------------------------------------
    // Strips

    public addStrip(source: StripSegmentsSource): StripHandle {
        const handle = this.nextHandle++;
        this.strips.set(handle, { source, pixels: 0, segments: 0, distance: 0 });
        return handle as StripHandle;
    }

    public removeStrip(handle: StripHandle) {
        this.strips.delete(handle);
    }

    // -----------------------------------------------------------------------------------------------------------
    // Frame

    public setAmbient(color: THREE.Color) {
        this.uniforms.uAmbientColor.value.copy(color);
    }

    /**
     * Once per frame before rendering: applies the quality level, prioritizes the lights (FR-023), renders the
     * shadow tiles (quality "high") and uploads lights and strip segments. `sceneVersion` changes whenever the static
     * scene geometry may have changed (SceneView raycast targets version); shadow tiles re-render then.
     */
    public update(camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: QualityProfile, sceneVersion = 0) {
        if (this.disposed) {
            return;
        }
        this.applyQuality(quality);
        this.syncShadowAtlas(renderer, quality);
        this.uploadLights(camera, scene, renderer, quality, sceneVersion);
        camera.getWorldPosition(this.cameraPosition);
        this.uploadSegments();
    }

    public dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.lights.clear();
        this.strips.clear();
        this.materials.clear();
        this.lightTexture.dispose();
        this.segmentTexture.dispose();
        this.gobos.dispose();
        this.disposeShadowAtlas();
        this.shadowPlaceholder.dispose();
        this.onNotice = null;
    }

    /** Resizes the data textures and recompiles the registered materials when the loop sizes change. */
    private applyQuality(quality: QualityProfile) {
        const maxLights = quality.fullLights + quality.simpleLights;
        const maxSegments = quality.stripSegments;
        if (maxLights === this.defines.MAX_LIGHTS && maxSegments === this.defines.MAX_SEGMENTS) {
            return;
        }
        if (maxLights !== this.defines.MAX_LIGHTS) {
            this.lightTexture.dispose();
            this.lightTexture = createDataTexture(LIGHT_TEXELS, maxLights);
            this.uniforms.uLightData.value = this.lightTexture;
        }
        if (maxSegments !== this.defines.MAX_SEGMENTS) {
            this.segmentTexture.dispose();
            this.segmentTexture = createDataTexture(SEGMENT_TEXELS, maxSegments);
            this.uniforms.uSegmentData.value = this.segmentTexture;
        }
        this.defines.MAX_LIGHTS = maxLights;
        this.defines.MAX_SEGMENTS = maxSegments;
        this.recompileMaterials();
    }

    /**
     * Device fallbacks (FR-055): compiles the shadow and/or gobo code out of the surface lighting shader, so a
     * program that failed to compile is rebuilt without it.
     */
    public setFallbacks(fallbacks: { shadows: boolean; gobos: boolean }) {
        if (fallbacks.shadows === this.defines.SL_NO_SHADOWS && fallbacks.gobos === this.defines.SL_NO_GOBOS) {
            return;
        }
        this.defines.SL_NO_SHADOWS = fallbacks.shadows;
        this.defines.SL_NO_GOBOS = fallbacks.gobos;
        this.recompileMaterials();
    }

    /** Re-applies the defines to all registered materials; their programs are rebuilt on the next render. */
    private recompileMaterials() {
        for (const material of this.materials) {
            material.defines = Object.assign(material.defines ?? {}, this.defines);
            material.needsUpdate = true;
        }
    }

    /**
     * Prioritizes the lit lights (lightPriority.ts) and uploads them, best first: `full` lights with gobo and prism,
     * then `simple` lights without (goboTile −1, prismFacets 0). `overflow` lights are summed (color × 0.02) into
     * `uOverflowLight` and left out of the texture. Lights with intensity 0 are skipped entirely. At quality "high"
     * the first `shadowLights` full spot lights get a shadow tile.
     */
    private uploadLights(camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: QualityProfile, sceneVersion: number) {
        const active = this.activeLights;
        active.length = 0;
        for (const record of this.lights.values()) {
            const d = record.data;
            if (!d || 0.2126 * d[8] + 0.7152 * d[9] + 0.0722 * d[10] < MIN_LIGHT || d[3] <= 0) {
                continue;
            }
            active.push(record.priority);
        }
        // the texture holds fullLights + simpleLights rows; quality may lag one frame behind MAX_LIGHTS
        const tierQuality = this.tierQuality(quality);
        this.tiers = assignTiers(active, camera, tierQuality, this.tiers);

        this.updateShadowTiles(active, camera, scene, renderer, quality, sceneVersion);

        const data = this.lightTexture.image.data as Float32Array;
        const max = this.defines.MAX_LIGHTS;
        const overflow = this.overflow.setRGB(0, 0, 0);
        let count = 0;
        for (const light of active) {
            const record = this.lights.get(light.key)!;
            const d = record.data!;
            const tier = this.tiers.get(light.key);
            if (tier === "overflow" || count >= max) {
                overflow.r += d[8] * OVERFLOW_FACTOR;
                overflow.g += d[9] * OVERFLOW_FACTOR;
                overflow.b += d[10] * OVERFLOW_FACTOR;
                continue;
            }
            const o = count * LIGHT_TEXELS * 4;
            data.set(d, o);
            if (record.type === "spot") {
                if (tier === "simple") {
                    data[o + 12] = -1;
                    data[o + 14] = 0;
                }
                const shadowTile = this.shadowTiles.get(light.key) ?? -1;
                data[o + 12] += SHADOW_TILE_STRIDE * (shadowTile + 1);
            }
            count++;
        }
        this.uniforms.uOverflowLight.value.copy(overflow);
        this.uniforms.uLightCount.value = count;
        this.lightTexture.needsUpdate = true;
    }

    /** `quality` with fullLights/simpleLights clamped to the rows of the light texture. */
    private tierQuality(quality: QualityProfile): QualityProfile {
        const max = this.defines.MAX_LIGHTS;
        if (quality.fullLights + quality.simpleLights <= max) {
            return quality;
        }
        const fullLights = Math.min(quality.fullLights, max);
        return { ...quality, fullLights, simpleLights: max - fullLights };
    }

    // -----------------------------------------------------------------------------------------------------------
    // Shadows (research R11, quality "high")

    /** Creates or drops the shadow atlas when `quality.shadowLights` changes; reports a notice when unavailable. */
    private syncShadowAtlas(renderer: THREE.WebGLRenderer, quality: QualityProfile) {
        if (quality.shadowLights <= 0) {
            this.disposeShadowAtlas();
            return;
        }
        if (this.shadowAtlas || this.shadowsUnavailable) {
            return;
        }
        const support = detectDeviceSupport(renderer);
        if (support.maxTextureUnits < MIN_TEXTURE_UNITS_FOR_SHADOWS) {
            this.shadowsUnavailable = true;
            this.onNotice?.({
                feature: "shadows",
                message: `Shadows are off: this device has only ${support.maxTextureUnits} texture units (${MIN_TEXTURE_UNITS_FOR_SHADOWS} needed).`,
            });
            return;
        }
        const atlas = ShadowAtlas.create<number>(renderer);
        if (!atlas) {
            this.shadowsUnavailable = true;
            this.onNotice?.({ feature: "shadows", message: "Shadows are off: the shadow depth texture could not be created on this device." });
            return;
        }
        this.shadowAtlas = atlas;
        this.uniforms.uShadowAtlas.value = atlas.depthTexture;
        this.uniforms.uShadowTiles.value = atlas.matrices;
    }

    private disposeShadowAtlas() {
        this.shadowTiles = new Map();
        this.shadowLights.length = 0;
        if (!this.shadowAtlas) {
            return;
        }
        this.shadowAtlas.dispose();
        this.shadowAtlas = null;
        this.uniforms.uShadowAtlas.value = this.shadowPlaceholder;
        this.uniforms.uShadowTiles.value = this.unusedShadowMatrices;
    }

    /** The first `shadowLights` full spot lights (in priority order) get a tile; changed tiles re-render. */
    private updateShadowTiles(
        sorted: ReadonlyArray<PrioritizedLight<number>>,
        camera: THREE.Camera,
        scene: THREE.Scene,
        renderer: THREE.WebGLRenderer,
        quality: QualityProfile,
        sceneVersion: number,
    ) {
        const atlas = this.shadowAtlas;
        if (!atlas) {
            return;
        }
        const limit = Math.min(quality.shadowLights, MAX_SHADOW_LIGHTS);
        const lights = this.shadowLights;
        let count = 0;
        for (const light of sorted) {
            if (count >= limit) {
                break;
            }
            const record = this.lights.get(light.key);
            if (!record || record.type !== "spot" || this.tiers.get(light.key) !== "full") {
                continue;
            }
            const d = record.data!;
            const entry = (lights[count] ??= {
                key: light.key,
                position: new THREE.Vector3(),
                direction: new THREE.Vector3(),
                angle: 0,
                range: 0,
            });
            entry.key = light.key;
            entry.position.set(d[0], d[1], d[2]);
            entry.direction.set(d[4], d[5], d[6]);
            entry.angle = record.angle;
            entry.range = d[3];
            count++;
        }
        lights.length = count;
        this.shadowTiles = atlas.update(renderer, scene, camera, lights, sceneVersion);
    }

    /**
     * Splits every visible strip into segments of about 0.5 m (whole pixels, at least one per strip). When the total
     * exceeds MAX_SEGMENTS, the segment counts are halved, farthest strips first, until it fits (data-model §3).
     */
    private uploadSegments() {
        const max = this.defines.MAX_SEGMENTS;
        const active: StripRecord[] = [];
        let total = 0;
        for (const strip of this.strips.values()) {
            const { worldPositions: p, colors, visible } = strip.source;
            const pixels = Math.min(Math.floor(p.length / 3), Math.floor(colors.length / 3));
            if (!visible || pixels === 0) {
                continue;
            }
            let length = 0;
            for (let i = 1; i < pixels; i++) {
                length += Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 1] - p[i * 3 - 2], p[i * 3 + 2] - p[i * 3 - 1]);
            }
            const mid = Math.floor(pixels / 2) * 3;
            strip.pixels = pixels;
            strip.segments = Math.min(pixels, Math.max(1, Math.round(length / SEGMENT_LENGTH)));
            strip.distance = this.cameraPosition.distanceTo(this.tmp.set(p[mid], p[mid + 1], p[mid + 2]));
            total += strip.segments;
            active.push(strip);
        }

        // farthest first
        active.sort((a, b) => b.distance - a.distance);
        let changed = true;
        while (total > max && changed) {
            changed = false;
            for (const strip of active) {
                if (total <= max) {
                    break;
                }
                if (strip.segments > 1) {
                    const halved = Math.ceil(strip.segments / 2);
                    total -= strip.segments - halved;
                    strip.segments = halved;
                    changed = true;
                }
            }
        }
        // still too many (more strips than segments): the nearest strips win
        const ordered = total > max ? [...active].reverse() : active;

        const data = this.segmentTexture.image.data as Float32Array;
        let count = 0;
        for (const strip of ordered) {
            count = this.writeStripSegments(strip, data, count, max);
            if (count >= max) {
                break;
            }
        }
        this.uniforms.uSegmentCount.value = count;
        this.segmentTexture.needsUpdate = true;
    }

    /** Writes the segments of one strip from index `start`; returns the next free index. */
    private writeStripSegments(strip: StripRecord, data: Float32Array, start: number, max: number): number {
        const { worldPositions: p, worldNormals: n, colors: c } = strip.source;
        const pixels = strip.pixels;
        // whole pixels per segment; rounded up so the strip never uses more segments than it was given
        const perSegment = Math.max(1, Math.ceil(pixels / strip.segments));
        const hasNormals = n.length >= pixels * 3;
        let index = start;
        for (let a = 0; a < pixels && index < max; a += perSegment) {
            const b = Math.min(pixels, a + perSegment);
            const o = index * SEGMENT_TEXELS * 4;
            // segment ends half a pixel spacing beyond its first and last pixel, so neighbouring segments touch
            this.edgePoint(p, pixels, a, -1, data, o);
            this.edgePoint(p, pixels, b - 1, 1, data, o + 4);
            data[o + 3] = 0;
            data[o + 7] = 0;
            let r = 0;
            let g = 0;
            let bl = 0;
            let nx = 0;
            let ny = 0;
            let nz = 0;
            for (let i = a; i < b; i++) {
                r += c[i * 3];
                g += c[i * 3 + 1];
                bl += c[i * 3 + 2];
                if (hasNormals) {
                    nx += n[i * 3];
                    ny += n[i * 3 + 1];
                    nz += n[i * 3 + 2];
                }
            }
            const count = b - a;
            data[o + 8] = r / count / 255;
            data[o + 9] = g / count / 255;
            data[o + 10] = bl / count / 255;
            const len = Math.hypot(nx, ny, nz);
            data[o + 11] = len > 1e-6 ? packNormal(nx / len, ny / len, nz / len) : packNormal(0, 1, 0);
            index++;
        }
        return index;
    }

    /** Pixel `i` moved half a pixel spacing towards its neighbour in direction `side` (−1 before, +1 after). */
    private edgePoint(p: Float32Array, pixels: number, i: number, side: -1 | 1, out: Float32Array, o: number) {
        const j = i + side;
        const k = j >= 0 && j < pixels ? j : i - side;
        if (k < 0 || k >= pixels) {
            out[o] = p[i * 3];
            out[o + 1] = p[i * 3 + 1];
            out[o + 2] = p[i * 3 + 2];
            return;
        }
        // towards the neighbour, or away from the opposite neighbour at the strip ends
        const f = k === j ? 0.5 : -0.5;
        out[o] = p[i * 3] + (p[k * 3] - p[i * 3]) * f;
        out[o + 1] = p[i * 3 + 1] + (p[k * 3 + 1] - p[i * 3 + 1]) * f;
        out[o + 2] = p[i * 3 + 2] + (p[k * 3 + 2] - p[i * 3 + 2]) * f;
    }
}
