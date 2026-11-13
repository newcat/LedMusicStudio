/**
 * Laser renderer (feature 003, T062): the beams of one laser projector as plain 1 px GL lines with an additive,
 * haze-dependent shader, plus additive sprites where the beams hit the scene.
 *
 * - Patterns (`state.pattern`): `beam` (1 beam), `fan` (N beams in a plane over the spread), `cone` (N beams on a
 *   cone), `sheet` (a dense fan, N × 4) and `dots` (N fixed pseudo-random directions inside the spread cone), with
 *   N = min(options.beams, quality.laserBeamsPerFixture).
 * - `size` scales the spread (0.5 = `options.spread`), `rotation` turns the pattern around the axis, `x`/`y` tilt the
 *   axis by up to ±30°.
 * - Hit points: one CPU raycast per beam against `raycastTargets`, redone only when the pattern, its transform or the
 *   targets changed.
 */
import * as THREE from "three";

import { NO_SHADOW_LAYER } from "../../../layers";
import type { FrameContext, RendererInputs } from "../../base.renderer";
import { EffectRenderer, type EffectStateOf } from "../effectRenderer";
import { createParticleMaterial } from "../particles";
import { defaultEffectOptions } from "../types";
import LASER_VERTEX_SHADER from "./laser.vertex.glsl?raw";
import LASER_FRAGMENT_SHADER from "./laser.fragment.glsl?raw";

/** Length in meters of a beam that hits nothing; it fades out towards this distance. */
const MAX_LASER_LENGTH = 50;
/** Axis offset of `x` / `y` at ±1. */
const AXIS_OFFSET = THREE.MathUtils.degToRad(30);
/** Largest total opening of a pattern. */
const MAX_SPREAD = THREE.MathUtils.degToRad(179);
/** Beams of a sheet per configured beam. */
const SHEET_DENSITY = 4;
const MAX_BEAMS = 64;
/** Brightness of the beam lines (values above 1 bloom). */
const BEAM_GAIN = 2;
/** Brightness and world diameter (m) of the hit sprites. */
const HIT_GAIN = 4;
const HIT_SIZE = 0.05;
/** Brightness of the body's emitter (the aperture) at full intensity. */
const APERTURE_GAIN = 3;

const PLUS_Z = new THREE.Vector3(0, 0, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Deterministic pseudo-random number in [0, 1) for beam `i` (fixed `dots` directions). */
function hash01(i: number, salt: number): number {
    const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

export class LaserRenderer extends EffectRenderer<"laser"> {
    private readonly lineGeometry = new THREE.BufferGeometry();
    private readonly lineMaterial: THREE.ShaderMaterial;
    private readonly lines: THREE.LineSegments;
    private readonly hitGeometry = new THREE.BufferGeometry();
    private readonly hitMaterial = createParticleMaterial({ additive: true });
    private readonly hitPoints: THREE.Points;

    /** Beam slots allocated in the buffers. */
    private capacity = 0;
    /** Beams drawn now. */
    private beamCount = 0;
    /** Local unit direction of each beam (effectOrigin space), 3 per beam. */
    private directions = new Float32Array(0);
    /** Hit distance of each beam in meters, or -1 without a hit. */
    private distances = new Float32Array(0);
    private linePositions = new Float32Array(0);
    private lineFade = new Float32Array(0);
    private hitPositions = new Float32Array(0);
    private hitColors = new Float32Array(0);
    private hitSizes = new Float32Array(0);
    private hitColorAttribute: THREE.BufferAttribute | null = null;

    /** Raycast cache: the pattern parameters, origin matrix and targets version of the last raycast. */
    private rayValid = false;
    private rayVersion = -1;
    private readonly rayMatrix = new THREE.Matrix4();
    private rayPattern = "";
    private rayCount = -1;
    private raySpread = NaN;
    private rayRotation = NaN;
    private rayX = NaN;
    private rayY = NaN;

    private readonly raycaster = new THREE.Raycaster();
    private readonly hits: THREE.Intersection[] = [];
    private readonly orientation = new THREE.Quaternion();
    private readonly tmpQuaternion = new THREE.Quaternion();
    private readonly direction = new THREE.Vector3();
    private readonly worldOrigin = new THREE.Vector3();
    private readonly worldDirection = new THREE.Vector3();
    private readonly drawingBufferSize = new THREE.Vector2();

    public constructor(inputs: RendererInputs) {
        super(inputs, defaultEffectOptions("laser"));
        this.raycaster.far = MAX_LASER_LENGTH;

        this.lineMaterial = new THREE.ShaderMaterial({
            vertexShader: LASER_VERTEX_SHADER,
            fragmentShader: LASER_FRAGMENT_SHADER,
            uniforms: {
                uColor: { value: new THREE.Color() },
                uIntensity: { value: 0 },
                uHaze: { value: 0 },
                uGain: { value: BEAM_GAIN },
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        this.lines = new THREE.LineSegments(this.lineGeometry, this.lineMaterial);
        this.lines.name = "laserBeams";
        this.hitPoints = new THREE.Points(this.hitGeometry, this.hitMaterial);
        this.hitPoints.name = "laserHits";
        this.hitPoints.onBeforeRender = (renderer) => {
            const target = renderer.getRenderTarget();
            const u = this.hitMaterial.uniforms;
            u.uViewportHeight.value = target ? target.height : renderer.getDrawingBufferSize(this.drawingBufferSize).y;
            u.uMinPointSize.value = 1.5 * renderer.getPixelRatio();
        };
        for (const object of [this.lines, this.hitPoints]) {
            // no shadows, no picking, no bounds (research R8, R11); the geometry changes, so no culling
            object.layers.set(NO_SHADOW_LAYER);
            object.raycast = () => undefined;
            object.userData.excludeFromBounds = true;
            object.frustumCulled = false;
            object.visible = false;
            this.effectOrigin.add(object);
        }
    }

    protected step(state: EffectStateOf<"laser">, frame: FrameContext): void {
        const on = state.on && state.intensity > 0 && this.isShown();
        const color = state.color;
        const aperture = on ? state.intensity * APERTURE_GAIN : 0;
        this.body?.setEmitterColor("all", color.r * aperture, color.g * aperture, color.b * aperture);

        this.lines.visible = on;
        this.hitPoints.visible = on;
        if (!on) {
            return;
        }

        const n = Math.max(1, Math.min(MAX_BEAMS, Math.round(state.beams), frame.quality.laserBeamsPerFixture));
        const count = state.pattern === "beam" ? 1 : state.pattern === "sheet" ? n * SHEET_DENSITY : n;
        const spread = Math.min(MAX_SPREAD, THREE.MathUtils.degToRad(this.options.spread) * state.size * 2);
        this.ensureCapacity(count);

        if (this.patternChanged(state, count, spread)) {
            this.buildDirections(state, count, spread);
            this.castRays();
            this.writeGeometry();
        }

        // hit sprite colors follow color and intensity every frame
        const hc = this.hitColors;
        const h = state.intensity * HIT_GAIN;
        for (let i = 0; i < this.beamCount; i++) {
            hc[i * 3] = color.r * h;
            hc[i * 3 + 1] = color.g * h;
            hc[i * 3 + 2] = color.b * h;
        }
        if (this.hitColorAttribute) {
            this.hitColorAttribute.needsUpdate = true;
        }

        const u = this.lineMaterial.uniforms;
        (u.uColor.value as THREE.Color).copy(color);
        u.uIntensity.value = state.intensity;
        u.uHaze.value = frame.haze;
    }

    public override dispose(): void {
        this.lines.removeFromParent();
        this.hitPoints.removeFromParent();
        this.lineGeometry.dispose();
        this.lineMaterial.dispose();
        this.hitGeometry.dispose();
        this.hitMaterial.dispose();
        super.dispose();
    }

    /** True when the beams must be rebuilt and raycast: new pattern parameters, a moved origin or new targets. */
    private patternChanged(state: EffectStateOf<"laser">, count: number, spread: number): boolean {
        const matrix = this.effectOrigin.matrixWorld;
        const version = this.inputs.raycastTargetsVersion();
        const unchanged =
            this.rayValid &&
            this.rayVersion === version &&
            this.rayPattern === state.pattern &&
            this.rayCount === count &&
            this.raySpread === spread &&
            this.rayRotation === state.rotation &&
            this.rayX === state.x &&
            this.rayY === state.y &&
            this.rayMatrix.equals(matrix);
        if (unchanged) {
            return false;
        }
        this.rayValid = true;
        this.rayVersion = version;
        this.rayPattern = state.pattern;
        this.rayCount = count;
        this.raySpread = spread;
        this.rayRotation = state.rotation;
        this.rayX = state.x;
        this.rayY = state.y;
        this.rayMatrix.copy(matrix);
        return true;
    }

    /** Local beam directions: the pattern around +Z, turned by `rotation`, then the axis tilted by `x` / `y`. */
    private buildDirections(state: EffectStateOf<"laser">, count: number, spread: number): void {
        const q = this.orientation.setFromAxisAngle(Y_AXIS, state.x * AXIS_OFFSET);
        q.multiply(this.tmpQuaternion.setFromAxisAngle(X_AXIS, -state.y * AXIS_OFFSET));
        q.multiply(this.tmpQuaternion.setFromAxisAngle(PLUS_Z, state.rotation));

        const half = spread / 2;
        const d = this.direction;
        const out = this.directions;
        for (let i = 0; i < count; i++) {
            switch (state.pattern) {
                case "beam":
                    d.copy(PLUS_Z);
                    break;
                case "fan":
                case "sheet": {
                    const a = count > 1 ? -half + (spread * i) / (count - 1) : 0;
                    d.set(Math.sin(a), 0, Math.cos(a));
                    break;
                }
                case "cone": {
                    const phi = (Math.PI * 2 * i) / count;
                    const s = Math.sin(half);
                    d.set(s * Math.cos(phi), s * Math.sin(phi), Math.cos(half));
                    break;
                }
                case "dots": {
                    // uniform on the spherical cap of the spread
                    const cosTheta = 1 - hash01(i, 1) * (1 - Math.cos(half));
                    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
                    const phi = Math.PI * 2 * hash01(i, 2);
                    d.set(sinTheta * Math.cos(phi), sinTheta * Math.sin(phi), cosTheta);
                    break;
                }
            }
            d.applyQuaternion(q);
            out[i * 3] = d.x;
            out[i * 3 + 1] = d.y;
            out[i * 3 + 2] = d.z;
        }
        this.beamCount = count;
    }

    /** One raycast per beam; `effectOrigin` has world scale 1, so world distances are local distances. */
    private castRays(): void {
        const targets = this.inputs.raycastTargets() as THREE.Object3D[];
        const matrix = this.effectOrigin.matrixWorld;
        this.worldOrigin.setFromMatrixPosition(matrix);
        for (let i = 0; i < this.beamCount; i++) {
            this.distances[i] = -1;
            if (targets.length === 0) {
                continue;
            }
            const dir = this.directions;
            this.worldDirection.set(dir[i * 3], dir[i * 3 + 1], dir[i * 3 + 2]).transformDirection(matrix);
            this.raycaster.set(this.worldOrigin, this.worldDirection);
            this.hits.length = 0;
            this.raycaster.intersectObjects(targets, false, this.hits);
            const hit = this.hits[0];
            if (hit) {
                this.distances[i] = Math.max(hit.distance, 1e-3);
            }
        }
        this.hits.length = 0;
    }

    /** Writes the line segments and hit sprites of the current beams. */
    private writeGeometry(): void {
        const dir = this.directions;
        const pos = this.linePositions;
        const fade = this.lineFade;
        const hitPos = this.hitPositions;
        const hitSize = this.hitSizes;
        for (let i = 0; i < this.beamCount; i++) {
            const distance = this.distances[i];
            const length = distance > 0 ? distance : MAX_LASER_LENGTH;
            const p = i * 6;
            pos.fill(0, p, p + 3);
            pos[p + 3] = dir[i * 3] * length;
            pos[p + 4] = dir[i * 3 + 1] * length;
            pos[p + 5] = dir[i * 3 + 2] * length;
            fade[i * 2] = 1;
            fade[i * 2 + 1] = distance > 0 ? 1 : 0;

            hitPos[i * 3] = pos[p + 3];
            hitPos[i * 3 + 1] = pos[p + 4];
            hitPos[i * 3 + 2] = pos[p + 5];
            hitSize[i] = distance > 0 ? HIT_SIZE : 0;
        }
        for (const name of ["position", "aFade"]) {
            this.lineGeometry.getAttribute(name).needsUpdate = true;
        }
        for (const name of ["position", "aSize"]) {
            this.hitGeometry.getAttribute(name).needsUpdate = true;
        }
        this.lineGeometry.setDrawRange(0, this.beamCount * 2);
        this.hitGeometry.setDrawRange(0, this.beamCount);
    }

    /** Grows the buffers to at least `count` beams (they never shrink). */
    private ensureCapacity(count: number): void {
        if (count <= this.capacity) {
            return;
        }
        const capacity = count;
        this.capacity = capacity;
        this.directions = new Float32Array(capacity * 3);
        this.distances = new Float32Array(capacity);
        this.linePositions = new Float32Array(capacity * 6);
        this.lineFade = new Float32Array(capacity * 2);
        this.hitPositions = new Float32Array(capacity * 3);
        this.hitColors = new Float32Array(capacity * 3);
        this.hitSizes = new Float32Array(capacity);
        this.beamCount = 0;
        this.rayValid = false;

        const dynamic = (array: Float32Array, size: number) =>
            new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
        // new arrays: drop the GPU buffers of the old ones
        this.lineGeometry.dispose();
        this.lineGeometry.setAttribute("position", dynamic(this.linePositions, 3));
        this.lineGeometry.setAttribute("aFade", dynamic(this.lineFade, 1));
        this.lineGeometry.setDrawRange(0, 0);
        this.hitGeometry.dispose();
        this.hitColorAttribute = dynamic(this.hitColors, 3);
        this.hitGeometry.setAttribute("position", dynamic(this.hitPositions, 3));
        this.hitGeometry.setAttribute("color", this.hitColorAttribute);
        this.hitGeometry.setAttribute("aSize", dynamic(this.hitSizes, 1));
        this.hitGeometry.setDrawRange(0, 0);
    }
}
