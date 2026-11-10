import * as THREE from "three";

import { QUALITY_PROFILES, type QualityProfile } from "../quality";

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

/** research R9; the real atlas comes with T026 (`goboAtlas.ts`). */
export interface GoboAtlas {
    readonly texture: THREE.Texture;
    /** SVG markup or "generic:<n>"; resolves to a tile index; images that fail to load use a generic pattern. */
    acquire(image: string): number;
    release(tile: number): void;
}

/** Texels per light / per segment in the data textures. */
const LIGHT_TEXELS = 4;
const SEGMENT_TEXELS = 3;
/** Target length of a strip segment in meters (research R10). */
const SEGMENT_LENGTH = 0.5;
/** Lights darker than this (luminance of color × intensity) are skipped. */
const MIN_LIGHT = 1e-4;

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

/** Placeholder until the gobo atlas exists: no tiles, every gobo renders open. */
class PlaceholderGoboAtlas implements GoboAtlas {
    public readonly texture = createPlaceholderTexture();

    public acquire(): number {
        return -1;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public release(): void {}

    public dispose() {
        this.texture.dispose();
    }
}

/** Normal (−1..1 per axis) quantized to 8 bit per axis and packed into one float (exact up to 2^24). */
function packNormal(x: number, y: number, z: number): number {
    const q = (v: number) => Math.round((Math.min(1, Math.max(-1, v)) * 0.5 + 0.5) * 255);
    return q(x) * 65536 + q(y) * 256 + q(z);
}

interface LightRecord {
    /** null until the first setLight. */
    data: Float32Array | null;
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
        uShadowTiles: { value: number };
    };
    /** Compile-time sizes of the light loops; they change only with the quality level. */
    public readonly defines: { MAX_LIGHTS: number; MAX_SEGMENTS: number };
    public readonly gobos: GoboAtlas;

    private readonly placeholderGobos: PlaceholderGoboAtlas;
    private readonly shadowPlaceholder = createPlaceholderTexture();
    private readonly lights = new Map<number, LightRecord>();
    private readonly strips = new Map<number, StripRecord>();
    private readonly materials = new Set<THREE.Material>();
    private nextHandle = 1;
    private lightTexture: THREE.DataTexture;
    private segmentTexture: THREE.DataTexture;
    private disposed = false;

    private readonly cameraPosition = new THREE.Vector3();
    private readonly tmp = new THREE.Vector3();

    public constructor(quality: QualityProfile = QUALITY_PROFILES.medium) {
        this.defines = { MAX_LIGHTS: quality.fullLights + quality.simpleLights, MAX_SEGMENTS: quality.stripSegments };
        this.lightTexture = createDataTexture(LIGHT_TEXELS, this.defines.MAX_LIGHTS);
        this.segmentTexture = createDataTexture(SEGMENT_TEXELS, this.defines.MAX_SEGMENTS);
        this.placeholderGobos = new PlaceholderGoboAtlas();
        this.gobos = this.placeholderGobos;
        this.uniforms = {
            uLightCount: { value: 0 },
            uLightData: { value: this.lightTexture },
            uSegmentCount: { value: 0 },
            uSegmentData: { value: this.segmentTexture },
            uGoboAtlas: { value: this.gobos.texture },
            uAmbientColor: { value: new THREE.Color(0, 0, 0) },
            uOverflowLight: { value: new THREE.Color(0, 0, 0) },
            uShadowAtlas: { value: this.shadowPlaceholder },
            uShadowTiles: { value: 0 },
        };
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
        this.lights.set(handle, { data: null });
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
        }
    }

    public removeLight(handle: LightHandle) {
        this.lights.delete(handle);
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

    /** Once per frame before rendering: applies the quality level and uploads lights and strip segments. */
    public update(camera: THREE.Camera, _scene: THREE.Scene, _renderer: THREE.WebGLRenderer, quality: QualityProfile) {
        if (this.disposed) {
            return;
        }
        this.applyQuality(quality);
        this.uploadLights();
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
        this.placeholderGobos.dispose();
        this.shadowPlaceholder.dispose();
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
        for (const material of this.materials) {
            material.defines = Object.assign(material.defines ?? {}, this.defines);
            material.needsUpdate = true;
        }
    }

    /** All lights up to MAX_LIGHTS in insertion order (tiers and overflow come with US3). */
    private uploadLights() {
        const data = this.lightTexture.image.data as Float32Array;
        const max = this.defines.MAX_LIGHTS;
        let count = 0;
        for (const record of this.lights.values()) {
            if (count >= max) {
                break;
            }
            const d = record.data;
            if (!d || 0.2126 * d[8] + 0.7152 * d[9] + 0.0722 * d[10] < MIN_LIGHT || d[3] <= 0) {
                continue;
            }
            data.set(d, count * LIGHT_TEXELS * 4);
            count++;
        }
        this.uniforms.uLightCount.value = count;
        this.lightTexture.needsUpdate = true;
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
