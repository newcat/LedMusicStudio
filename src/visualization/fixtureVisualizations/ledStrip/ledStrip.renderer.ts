import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { assetCatalog } from "@/assetLibrary/catalog";
import { templateKey } from "@/assetLibrary/assetCache";
import type { FixtureAssetDefinition } from "@/assetLibrary/types";
import { VisualizationType } from "../../fixtureVisualization";
import { NO_SHADOW_LAYER } from "../../layers";
import type { StripHandle } from "../../lighting/surfaceLighting";
import { BaseRenderer, type RendererInputs } from "../base.renderer";
import LED_PIXELS_VERTEX_SHADER from "./ledPixels.vertex.glsl?raw";
import LED_PIXELS_FRAGMENT_SHADER from "./ledPixels.fragment.glsl?raw";
import { pixelPositions, StripPathSampler, unlinkedPixelCount } from "./stripPath";
import { defaultStripPath, type LedStripVisualizationConfig, type StripPath } from "./types";

const PLUS_Y = new THREE.Vector3(0, 1, 0);
const PLUS_Z = new THREE.Vector3(0, 0, 1);
/** Minimum on-screen pixel size in CSS pixels (research R10). */
const MIN_POINT_CSS_PX = 1.5;
/** The pixels sit this far above the diffuser so they are not hidden by it. */
const PIXEL_LIFT = 0.001;
/** Below this length (meters) the pitch is computed from this length instead (all pixels on the first point). */
const MIN_PITCH_LENGTH = 0.01;
/** Extrusion steps of a curved body per path segment, and the overall cap. */
const CURVE_STEPS_PER_SEGMENT = 16;
const MAX_CURVE_STEPS = 2048;

function isInVisibleHierarchy(obj: THREE.Object3D | null): boolean {
    for (let current = obj; current; current = current.parent) {
        if (!current.visible) {
            return false;
        }
    }
    return true;
}

/** A sampler for the path, or for the default path if the path is unusable (fewer than 2 points). */
function createSampler(path: StripPath | undefined): StripPathSampler {
    try {
        if (path) {
            return new StripPathSampler(path);
        }
    } catch {
        // falls through to the default path
    }
    return new StripPathSampler(defaultStripPath());
}

/** `normal` made orthogonal to `tangent` (unit); a normal along the tangent falls back to +Y, then +Z. */
function orthogonalNormal(tangent: THREE.Vector3, normal: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(normal).addScaledVector(tangent, -normal.dot(tangent));
    if (out.lengthSq() < 1e-8) {
        const reference = Math.abs(tangent.dot(PLUS_Y)) > 0.999 ? PLUS_Z : PLUS_Y;
        out.copy(reference).addScaledVector(tangent, -reference.dot(tangent));
    }
    return out.normalize();
}

/**
 * The path as a three curve (arc-length parametrized through the sampler) whose frames follow the point normals,
 * so `ExtrudeGeometry` sweeps the profile with the diffuser (shape +x) facing the normals.
 */
class SamplerCurve extends THREE.Curve<THREE.Vector3> {
    private readonly tmpNormal = new THREE.Vector3();

    public constructor(private readonly sampler: StripPathSampler) {
        super();
    }

    public override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        this.sampler.sample(t, target, this.tmpNormal);
        return target;
    }

    public override computeFrenetFrames(segments: number): { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] } {
        const tangents: THREE.Vector3[] = [];
        const normals: THREE.Vector3[] = [];
        const binormals: THREE.Vector3[] = [];
        const position = new THREE.Vector3();
        const pointNormal = new THREE.Vector3();
        for (let i = 0; i <= segments; i++) {
            const u = i / segments;
            const tangent = this.getTangentAt(u, new THREE.Vector3()).normalize();
            this.sampler.sample(u, position, pointNormal);
            const normal = orthogonalNormal(tangent, pointNormal, new THREE.Vector3());
            tangents.push(tangent);
            normals.push(normal);
            binormals.push(new THREE.Vector3().crossVectors(tangent, normal));
        }
        return { tangents, normals, binormals };
    }
}

/**
 * Cross-section part of the profile body: one material slot of the strip model, as a rectangle in the profile
 * frame (y along the emission normal, 0 = path; z across the strip).
 */
interface ProfileSection {
    material: THREE.Material;
    y0: number;
    y1: number;
    z0: number;
    z1: number;
}

/**
 * LED strip (feature 003, research R10): every pixel is drawn as a round soft point along the strip path, the
 * profile of the strip model is swept along the path as the body (pickable), and the pixels light surfaces through
 * the view's `SurfaceLighting` (as segments, built there from the world pixel positions and colors).
 */
export class LedStripRenderer extends BaseRenderer<LedStripVisualizationConfig> {
    private path: StripPath = defaultStripPath();
    private pathKey = "";
    private sampler: StripPathSampler = createSampler(this.path);
    private intensity = 1;
    private pixelSize = 0.6;

    /** Raw value bytes (whole pixels), null = no value (unlinked). */
    private raw: Uint8Array | null = null;
    private pixelCount = -1;
    /** Object-local pixel positions (lifted above the diffuser) and normals. */
    private localPositions = new Float32Array(0);
    private localNormals = new Float32Array(0);
    /** Value bytes × intensity; the color attribute and the lighting source share this array. */
    private colors = new Uint8Array(0);

    private geometry = new THREE.BufferGeometry();
    private readonly material: THREE.ShaderMaterial;
    private readonly points: THREE.Points;
    private readonly drawingBufferSize = new THREE.Vector2();

    /** Read by SurfaceLighting every frame. */
    private readonly segmentSource = {
        worldPositions: new Float32Array(0),
        worldNormals: new Float32Array(0),
        colors: new Uint8Array(0) as Uint8Array,
        visible: false,
    };
    private readonly stripHandle: StripHandle;
    private readonly lastMatrixWorld = new THREE.Matrix4();
    private worldDirty = true;
    private readonly worldNormalMatrix = new THREE.Matrix3();
    private readonly tmp = new THREE.Vector3();

    private modelId: string | null = null;
    private definition: FixtureAssetDefinition | null = null;
    /** Template of the strip model (its slot materials are used by the body) and its cache key. */
    private modelTemplateKey: string | null = null;
    private pendingTemplateKey: string | null = null;
    private sections: ProfileSection[] = [];
    private request = 0;
    private profileBody: THREE.Group | null = null;
    private disposed = false;

    private proxy: THREE.Group | null = null;

    public constructor(inputs: RendererInputs) {
        super(inputs);
        this.material = new THREE.ShaderMaterial({
            vertexShader: LED_PIXELS_VERTEX_SHADER,
            fragmentShader: LED_PIXELS_FRAGMENT_SHADER,
            uniforms: {
                uPointSize: { value: 0.01 },
                uViewportHeight: { value: 1 },
                uMinPointSize: { value: MIN_POINT_CSS_PX },
            },
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.name = "ledPixels";
        // pixels never cast shadows (research R11)
        this.points.layers.set(NO_SHADOW_LAYER);
        // the body is picked, not the pixels (Points would be hit within the raycaster's 1 m point threshold)
        this.points.raycast = () => undefined;
        this.points.onBeforeRender = (renderer) => {
            const target = renderer.getRenderTarget();
            const height = target ? target.height : renderer.getDrawingBufferSize(this.drawingBufferSize).y;
            this.material.uniforms.uViewportHeight.value = height;
            this.material.uniforms.uMinPointSize.value = MIN_POINT_CSS_PX * renderer.getPixelRatio();
        };
        this.add(this.points);
        this.stripHandle = inputs.lighting.addStrip(this.segmentSource);
        this.layoutPixels();
    }

    public override dispose() {
        this.disposed = true;
        this.request++;
        this.inputs.lighting.removeStrip(this.stripHandle);
        this.geometry.dispose();
        this.material.dispose();
        if (this.proxy) {
            this.proxy.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.geometry.dispose();
                    (o.material as THREE.Material).dispose();
                }
            });
        }
        this.disposeBody();
        if (this.pendingTemplateKey) {
            this.inputs.assets.release(this.pendingTemplateKey, this.uuid);
            this.pendingTemplateKey = null;
        }
        this.releaseTemplate();
        super.dispose();
    }

    public override onModelUpdate(modelId: string): void {
        if (modelId === this.modelId) {
            return;
        }
        this.modelId = modelId;
        this.definition = this.resolveStripModel();
        this.loadTemplate(this.definition);
        // the pixel lift depends on the profile height
        this.layoutPixels();
    }

    public override onConfigUpdate(config: LedStripVisualizationConfig): void {
        const pathKey = JSON.stringify(config.path ?? null);
        const pathChanged = pathKey !== this.pathKey;
        if (pathChanged) {
            this.pathKey = pathKey;
            // a private copy: the config object may be edited in place later
            this.path = config.path ? (JSON.parse(pathKey) as StripPath) : defaultStripPath();
            this.sampler = createSampler(this.path);
        }
        const intensity = Math.min(1, Math.max(0, Number.isFinite(config.intensity) ? config.intensity : 1));
        const intensityChanged = intensity !== this.intensity;
        this.intensity = intensity;
        this.pixelSize = Math.min(1, Math.max(0.2, Number.isFinite(config.pixelSize) ? config.pixelSize : 0.6));

        if (pathChanged) {
            this.layoutPixels();
            this.buildBody();
            this.updateProxy();
        } else {
            this.updatePointSize();
            if (intensityChanged) {
                this.updateColors();
            }
        }
    }

    public override onFixtureValueUpdate(data: Uint8Array): void {
        const whole = data.length - (data.length % 3);
        this.raw = whole > 0 ? (whole === data.length ? data : data.subarray(0, whole)) : null;
        if (this.targetPixelCount() !== this.pixelCount) {
            this.layoutPixels();
        } else {
            this.updateColors();
        }
    }

    /** Transforms the pixels to world space for the surface lighting (only when the transform or layout changed). */
    public override update(): void {
        const source = this.segmentSource;
        source.visible = isInVisibleHierarchy(this) && this.pixelCount > 0;
        if (!source.visible) {
            return;
        }
        if (!this.worldDirty && this.lastMatrixWorld.equals(this.matrixWorld)) {
            return;
        }
        this.worldDirty = false;
        this.lastMatrixWorld.copy(this.matrixWorld);
        this.worldNormalMatrix.getNormalMatrix(this.matrixWorld);
        const n = this.pixelCount;
        const lp = this.localPositions;
        const ln = this.localNormals;
        const wp = source.worldPositions;
        const wn = source.worldNormals;
        const v = this.tmp;
        for (let i = 0; i < n; i++) {
            const o = i * 3;
            v.set(lp[o], lp[o + 1], lp[o + 2]).applyMatrix4(this.matrixWorld);
            wp[o] = v.x;
            wp[o + 1] = v.y;
            wp[o + 2] = v.z;
            v.set(ln[o], ln[o + 1], ln[o + 2]).applyMatrix3(this.worldNormalMatrix).normalize();
            wn[o] = v.x;
            wn[o + 1] = v.y;
            wn[o + 2] = v.z;
        }
    }

    /** Only the emission direction arrow at the path midpoint; the profile body itself is pickable. */
    public override createEditorProxy(): THREE.Object3D {
        if (!this.proxy) {
            this.proxy = new THREE.Group();
            const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
            arrow.name = "arrow";
            this.proxy.add(arrow);
            this.updateProxy();
        }
        return this.proxy;
    }

    // -----------------------------------------------------------------------------------------------------------
    // Pixels

    /** N = the value's pixel count, or round(length × 30) without a value (data-model §3). */
    private targetPixelCount(): number {
        return this.raw ? this.raw.length / 3 : unlinkedPixelCount(this.sampler.length);
    }

    /** Recomputes the object-local pixel positions (and the buffers when N changed). */
    private layoutPixels() {
        const n = this.targetPixelCount();
        if (n !== this.pixelCount) {
            this.pixelCount = n;
            this.localPositions = new Float32Array(n * 3);
            this.localNormals = new Float32Array(n * 3);
            this.colors = new Uint8Array(n * 3);
            this.segmentSource.worldPositions = new Float32Array(n * 3);
            this.segmentSource.worldNormals = new Float32Array(n * 3);
            this.segmentSource.colors = this.colors;
            // new attribute sizes: a new geometry frees the old GPU buffers
            this.geometry.dispose();
            this.geometry = new THREE.BufferGeometry();
            this.geometry.setAttribute("position", new THREE.BufferAttribute(this.localPositions, 3));
            // BufferAttribute (not Uint8BufferAttribute, which copies the array): the attribute must share `colors`
            this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3, true));
            this.points.geometry = this.geometry;
        }
        if (n > 0) {
            pixelPositions(this.sampler, n, this.localPositions, this.localNormals);
            const lift = this.profileHeight() + PIXEL_LIFT;
            const p = this.localPositions;
            const nm = this.localNormals;
            for (let i = 0; i < n * 3; i++) {
                p[i] += nm[i] * lift;
            }
        }
        this.geometry.getAttribute("position").needsUpdate = true;
        this.geometry.computeBoundingSphere();
        this.points.visible = n > 0;
        this.worldDirty = true;
        this.updatePointSize();
        this.updateColors();
    }

    /** Point size in world units: the LED pitch × pixelSize. */
    private updatePointSize() {
        const n = Math.max(1, this.pixelCount);
        const pitch = Math.max(this.sampler.length, MIN_PITCH_LENGTH) / n;
        this.material.uniforms.uPointSize.value = pitch * this.pixelSize;
    }

    /** Value bytes × intensity into the shared color array (no `Color[]` copies). */
    private updateColors() {
        const colors = this.colors;
        const raw = this.raw;
        const intensity = this.intensity;
        if (!raw) {
            colors.fill(0);
        } else if (intensity >= 1) {
            colors.set(raw.subarray(0, colors.length));
        } else {
            const len = Math.min(colors.length, raw.length);
            for (let i = 0; i < len; i++) {
                colors[i] = Math.round(raw[i] * intensity);
            }
        }
        this.geometry.getAttribute("color").needsUpdate = true;
    }

    // -----------------------------------------------------------------------------------------------------------
    // Body

    /** The strip's model, or the default LED strip body for unknown or unsuitable ids. */
    private resolveStripModel(): FixtureAssetDefinition {
        const def = assetCatalog.get(this.modelId ?? "");
        if (
            def?.category === "fixtures" &&
            def.fixture.visualizationTypes.includes(VisualizationType.LED_STRIP) &&
            def.fixture.ledStrip &&
            def.source.type === "parametric" &&
            !assetCatalog.isInvalid(def.id)
        ) {
            return def;
        }
        return assetCatalog.defaultModelFor(VisualizationType.LED_STRIP);
    }

    private profileHeight(): number {
        return this.definition?.fixture.ledStrip?.profileHeight ?? 0.02;
    }

    /** Acquires the strip model's template once per model; its slot materials are copied onto the swept body. */
    private loadTemplate(definition: FixtureAssetDefinition) {
        const key = templateKey(definition.id, null, null, null, null);
        if (key === this.modelTemplateKey || key === this.pendingTemplateKey) {
            if (key === this.modelTemplateKey && this.pendingTemplateKey) {
                // back to the current model: drop the pending one
                this.inputs.assets.release(this.pendingTemplateKey, this.uuid);
                this.pendingTemplateKey = null;
                this.request++;
            }
            return;
        }
        if (this.pendingTemplateKey) {
            this.inputs.assets.release(this.pendingTemplateKey, this.uuid);
        }
        this.pendingTemplateKey = key;
        const request = ++this.request;
        void this.inputs.assets.acquire({ assetId: definition.id }, this.uuid).then((template) => {
            if (request !== this.request || this.disposed) {
                // a newer request or the disposal took over (and released this key already)
                return;
            }
            this.pendingTemplateKey = null;
            if (!template) {
                this.inputs.assets.release(key, this.uuid);
                console.error(`[asset-library] LED strip model "${definition.id}" could not be loaded`);
                return;
            }
            this.releaseTemplate();
            this.modelTemplateKey = key;
            this.sections = this.extractSections(definition, template);
            this.buildBody();
        });
    }

    private releaseTemplate() {
        if (this.modelTemplateKey) {
            this.inputs.assets.release(this.modelTemplateKey, this.uuid);
            this.modelTemplateKey = null;
        }
        this.sections = [];
    }

    /**
     * The cross-section of every `slot:*` mesh of the template (built along +X, diffuser +Y) as a rectangle, scaled
     * to `fixture.ledStrip.profileWidth/Height` with the profile's bottom on the path.
     */
    private extractSections(definition: FixtureAssetDefinition, template: THREE.Object3D): ProfileSection[] {
        template.updateMatrixWorld(true);
        const parts: Array<{ material: THREE.Material; box: THREE.Box3 }> = [];
        const overall = new THREE.Box3();
        template.traverse((child) => {
            if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) {
                return;
            }
            const box = new THREE.Box3().setFromObject(child, true);
            if (box.isEmpty()) {
                return;
            }
            parts.push({ material: child.material as THREE.Material, box });
            overall.union(box);
        });
        if (parts.length === 0) {
            return [];
        }
        const size = overall.getSize(new THREE.Vector3());
        const profile = definition.fixture.ledStrip ?? { profileWidth: size.z, profileHeight: size.y };
        const sy = size.y > 1e-6 ? profile.profileHeight / size.y : 1;
        const sz = size.z > 1e-6 ? profile.profileWidth / size.z : 1;
        const cz = (overall.min.z + overall.max.z) / 2;
        return parts.map(({ material, box }) => ({
            material,
            y0: (box.min.y - overall.min.y) * sy,
            y1: (box.max.y - overall.min.y) * sy,
            z0: (box.min.z - cz) * sz,
            z1: (box.max.z - cz) * sz,
        }));
    }

    /** Sweeps the profile sections along the path: extruded along the curve, or merged boxes per linear segment. */
    private buildBody() {
        if (this.disposed || this.sections.length === 0) {
            return;
        }
        this.disposeBody();
        const body = new THREE.Group();
        body.name = "ledProfile";
        for (const section of this.sections) {
            const geometry = this.path.interpolation === "curve" ? this.curveGeometry(section) : this.linearGeometry(section);
            if (geometry) {
                body.add(new THREE.Mesh(geometry, section.material));
            }
        }
        this.profileBody = body;
        this.add(body);
    }

    private curveGeometry(section: ProfileSection): THREE.BufferGeometry | null {
        if (this.sampler.length < 1e-4) {
            return null;
        }
        const segments = Math.max(1, this.path.closed ? this.path.points.length : this.path.points.length - 1);
        const steps = Math.min(MAX_CURVE_STEPS, segments * CURVE_STEPS_PER_SEGMENT);
        // shape x runs along the frame normal (emission direction), shape y along the binormal (= profile z)
        const shape = new THREE.Shape([
            new THREE.Vector2(section.y0, section.z0),
            new THREE.Vector2(section.y1, section.z0),
            new THREE.Vector2(section.y1, section.z1),
            new THREE.Vector2(section.y0, section.z1),
        ]);
        return new THREE.ExtrudeGeometry(shape, { steps, bevelEnabled: false, extrudePath: new SamplerCurve(this.sampler) });
    }

    private linearGeometry(section: ProfileSection): THREE.BufferGeometry | null {
        const points = this.path.points;
        const count = points.length;
        const segmentCount = this.path.closed ? count : count - 1;
        // boxes reach half a profile width into each inner joint, so corners have no gaps
        const overlap = Math.max(Math.abs(section.z0), Math.abs(section.z1));
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const x = new THREE.Vector3();
        const y = new THREE.Vector3();
        const z = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const basis = new THREE.Matrix4();
        const parts: THREE.BufferGeometry[] = [];
        for (let i = 0; i < segmentCount; i++) {
            const pa = points[i];
            const pb = points[(i + 1) % count];
            a.fromArray(pa.position);
            b.fromArray(pb.position);
            const length = x.subVectors(b, a).length();
            if (length < 1e-6) {
                continue;
            }
            x.divideScalar(length);
            normal.fromArray(pa.normal).add(this.tmp.fromArray(pb.normal));
            orthogonalNormal(x, normal, y);
            z.crossVectors(x, y);
            const startExt = this.path.closed || i > 0 ? overlap : 0;
            const endExt = this.path.closed || i < segmentCount - 1 ? overlap : 0;
            const box = new THREE.BoxGeometry(length + startExt + endExt, section.y1 - section.y0, section.z1 - section.z0);
            box.translate((length + endExt - startExt) / 2, (section.y0 + section.y1) / 2, (section.z0 + section.z1) / 2);
            box.applyMatrix4(basis.makeBasis(x, y, z).setPosition(a));
            parts.push(box);
        }
        if (parts.length === 0) {
            return null;
        }
        const merged = mergeGeometries(parts, false);
        parts.forEach((p) => p.dispose());
        return merged;
    }

    private disposeBody() {
        if (!this.profileBody) {
            return;
        }
        this.profileBody.removeFromParent();
        this.profileBody.traverse((o) => {
            if (o instanceof THREE.Mesh) {
                // the materials belong to the template
                o.geometry.dispose();
            }
        });
        this.profileBody = null;
    }

    // -----------------------------------------------------------------------------------------------------------
    // Editor proxy

    /** The arrow shows the emission direction at the path midpoint. */
    private updateProxy() {
        if (!this.proxy) {
            return;
        }
        const arrow = this.proxy.getObjectByName("arrow") as THREE.Mesh;
        const position = new THREE.Vector3();
        const normal = new THREE.Vector3();
        this.sampler.sample(0.5, position, normal);
        if (normal.lengthSq() < 1e-8) {
            normal.copy(PLUS_Y);
        }
        arrow.quaternion.setFromUnitVectors(PLUS_Y, normal);
        arrow.position.copy(position).addScaledVector(normal, this.profileHeight() + 0.1);
    }
}
