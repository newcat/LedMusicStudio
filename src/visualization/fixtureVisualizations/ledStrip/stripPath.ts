import * as THREE from "three";

import type { StripPath, StripPathPoint } from "./types";

/** Arc-length table resolution per path segment. */
const SAMPLES_PER_SEGMENT = 16;
/** Below this total length (meters) all pixels collapse onto the first point. */
const MIN_LENGTH = 0.01;
/** Pixel density of an unlinked LED strip (pixels per meter). */
const PIXELS_PER_METER = 30;

/** Pixel count of an unlinked LED strip with the given length in meters (N = round(length × 30)). */
export function unlinkedPixelCount(length: number): number {
    return Math.round(length * PIXELS_PER_METER);
}

/**
 * Arc-length parametrized view of a strip path (object-local space). `sample(t)` takes t as a fraction of the total
 * length in [0, 1] and returns the position and the interpolated emission normal at that point.
 * Linear paths are straight segments; curve paths are a centripetal Catmull-Rom spline through the points.
 */
export class StripPathSampler {
    /** Total path length in meters. */
    readonly length: number;

    private readonly vertices: THREE.Vector3[];
    private readonly normals: THREE.Vector3[];
    private readonly curve: THREE.CatmullRomCurve3 | null;
    private readonly segmentCount: number;
    /** Cumulative arc length at each table sample, cumulative[0] = 0. */
    private readonly cumulative: Float64Array;
    private readonly tablePositions: Float64Array;
    private readonly tableNormals: Float64Array;

    private readonly tmpPos = new THREE.Vector3();
    private readonly tmpNormal = new THREE.Vector3();

    constructor(path: StripPath) {
        if (path.points.length < 2) {
            throw new Error("A strip path needs at least 2 points.");
        }
        this.vertices = path.points.map((p: StripPathPoint) => new THREE.Vector3(...p.position));
        this.normals = path.points.map((p: StripPathPoint) => new THREE.Vector3(...p.normal).normalize());

        const count = this.vertices.length;
        this.segmentCount = path.closed ? count : count - 1;
        this.curve =
            path.interpolation === "curve"
                ? new THREE.CatmullRomCurve3(this.vertices, path.closed, "centripetal")
                : null;

        const sampleCount = this.segmentCount * SAMPLES_PER_SEGMENT;
        this.cumulative = new Float64Array(sampleCount + 1);
        this.tablePositions = new Float64Array(3 * (sampleCount + 1));
        this.tableNormals = new Float64Array(3 * (sampleCount + 1));

        const previous = new THREE.Vector3();
        for (let k = 0; k <= sampleCount; k++) {
            this.evaluate(k / sampleCount, this.tmpPos, this.tmpNormal);
            this.tablePositions.set([this.tmpPos.x, this.tmpPos.y, this.tmpPos.z], 3 * k);
            this.tableNormals.set([this.tmpNormal.x, this.tmpNormal.y, this.tmpNormal.z], 3 * k);
            if (k > 0) {
                this.cumulative[k] = this.cumulative[k - 1] + previous.distanceTo(this.tmpPos);
            }
            previous.copy(this.tmpPos);
        }
        this.length = this.cumulative[sampleCount];
    }

    /**
     * Position and normal at fraction `t` (0..1, clamped) of the total arc length.
     * Writes into `outPos` and `outNormal`.
     */
    sample(t: number, outPos: THREE.Vector3, outNormal: THREE.Vector3): void {
        const last = this.cumulative.length - 1;
        const target = Math.min(Math.max(t, 0), 1) * this.length;

        // Largest table index whose cumulative length is <= target.
        let lo = 0;
        let hi = last;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (this.cumulative[mid] <= target) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        const idx = Math.min(lo, last - 1);
        const span = this.cumulative[idx + 1] - this.cumulative[idx];
        const f = span > 0 ? Math.min(Math.max((target - this.cumulative[idx]) / span, 0), 1) : 0;

        const a = 3 * idx;
        const b = 3 * (idx + 1);
        outPos.set(
            lerp(this.tablePositions[a], this.tablePositions[b], f),
            lerp(this.tablePositions[a + 1], this.tablePositions[b + 1], f),
            lerp(this.tablePositions[a + 2], this.tablePositions[b + 2], f),
        );
        outNormal.set(
            lerp(this.tableNormals[a], this.tableNormals[b], f),
            lerp(this.tableNormals[a + 1], this.tableNormals[b + 1], f),
            lerp(this.tableNormals[a + 2], this.tableNormals[b + 2], f),
        );
        if (outNormal.lengthSq() > 0) {
            outNormal.normalize();
        }
    }

    /** Position and normal at path parameter `u` (0..1, uniform per segment), before arc-length mapping. */
    private evaluate(u: number, outPos: THREE.Vector3, outNormal: THREE.Vector3): void {
        if (this.curve) {
            this.curve.getPoint(u, outPos);
        }
        const scaled = u * this.segmentCount;
        const idx = Math.min(Math.floor(scaled), this.segmentCount - 1);
        const f = scaled - idx;
        const next = (idx + 1) % this.vertices.length;

        if (!this.curve) {
            outPos.lerpVectors(this.vertices[idx], this.vertices[next], f);
        }
        outNormal.lerpVectors(this.normals[idx], this.normals[next], f);
        if (outNormal.lengthSq() > 0) {
            outNormal.normalize();
        }
    }
}

/**
 * Places `n` pixels evenly along the sampler: pixel i at arc length (i + 0.5) / n × length.
 * Paths shorter than 1 cm put every pixel on the first point.
 * `outPositions` and `outNormals` hold 3 floats per pixel.
 */
export function pixelPositions(
    sampler: StripPathSampler,
    n: number,
    outPositions: Float32Array,
    outNormals: Float32Array,
): void {
    if (outPositions.length < 3 * n || outNormals.length < 3 * n) {
        throw new Error("Output arrays are too small for the pixel count.");
    }
    const pos = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const short = sampler.length < MIN_LENGTH;
    for (let i = 0; i < n; i++) {
        sampler.sample(short ? 0 : (i + 0.5) / n, pos, normal);
        outPositions.set([pos.x, pos.y, pos.z], 3 * i);
        outNormals.set([normal.x, normal.y, normal.z], 3 * i);
    }
}

function lerp(a: number, b: number, f: number): number {
    return a + (b - a) * f;
}
