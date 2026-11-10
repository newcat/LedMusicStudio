import * as THREE from "three";

import { assetCatalog } from "@/assetLibrary/catalog";
import { instantiate, templateKey } from "@/assetLibrary/assetCache";
import type { FixtureAssetDefinition, ParamValues } from "@/assetLibrary/types";
import type { Color } from "@/graph/colors";
import { VisualizationType } from "../../fixtureVisualization";
import type { StripHandle } from "../../lighting/surfaceLighting";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import type { LedStripVisualizationConfig } from "./types";

const PLUS_Y = new THREE.Vector3(0, 1, 0);
const PLUS_Z = new THREE.Vector3(0, 0, 1);

/** Length parameter of the body, rounded to 1 cm to limit rebuilds. */
function roundedLength(length: number): number {
    return Math.round(length * 100) / 100;
}

function isInVisibleHierarchy(obj: THREE.Object3D | null): boolean {
    for (let current = obj; current; current = current.parent) {
        if (!current.visible) {
            return false;
        }
    }
    return true;
}

/** Pixel colors as flat 0..255 RGB bytes; accepts `Color[]` and already flat values. */
function toPixelBytes(data: Color[] | Uint8Array | null | undefined): Uint8Array {
    if (!data) {
        return new Uint8Array(0);
    }
    if (data instanceof Uint8Array) {
        return data.length % 3 === 0 ? data : data.subarray(0, data.length - (data.length % 3));
    }
    const bytes = new Uint8Array(data.length * 3);
    data.forEach((c, i) => {
        bytes[i * 3] = c?.[0] ?? 0;
        bytes[i * 3 + 1] = c?.[1] ?? 0;
        bytes[i * 3 + 2] = c?.[2] ?? 0;
    });
    return bytes;
}

/**
 * LED strip (feature 002, research R7): a parametric profile body between `start` and `end`, whose diffuser faces
 * the emission direction (the object's local +Y). The body is pickable; the editor proxy only shows the direction.
 * Its pixels light surfaces through the view's `SurfaceLighting` (one pixel per LED, evenly along the strip).
 */
export class LedStripRenderer extends BaseRenderer<LedStripVisualizationConfig, Color[] | Uint8Array> {
    private readonly start = new THREE.Vector3(-0.5, 0, 0);
    private readonly end = new THREE.Vector3(0.5, 0, 0);
    /** Read by SurfaceLighting every frame; positions and normals are refreshed in `updateWorld`. */
    private readonly segmentSource = {
        worldPositions: new Float32Array(0),
        worldNormals: new Float32Array(0),
        colors: new Uint8Array(0) as Uint8Array,
        visible: false,
    };
    private readonly stripHandle: StripHandle;
    private readonly tmpPoint = new THREE.Vector3();
    private readonly tmpNormal = new THREE.Vector3();
    private readonly worldNormalMatrix = new THREE.Matrix3();
    private proxy: THREE.Group | null = null;

    private modelId = "";
    private profile: THREE.Object3D | null = null;
    private profileKey: string | null = null;
    private pendingKey: string | null = null;
    private request = 0;
    private disposed = false;

    public constructor(inputs: RendererInputs) {
        super(inputs);
        this.stripHandle = inputs.lighting.addStrip(this.segmentSource);
    }

    public override dispose() {
        this.disposed = true;
        this.request++;
        this.inputs.lighting.removeStrip(this.stripHandle);
        if (this.proxy) {
            this.proxy.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.geometry.dispose();
                    (o.material as THREE.Material).dispose();
                }
            });
        }
        if (this.pendingKey && this.pendingKey !== this.profileKey) {
            this.inputs.assets.release(this.pendingKey, this.uuid);
        }
        this.pendingKey = null;
        this.releaseProfile();
        super.dispose();
    }

    public override onModelUpdate(modelId: string): void {
        this.modelId = modelId;
        this.updateProfile();
    }

    public override onConfigUpdate(config: LedStripVisualizationConfig): void {
        this.start.set(...config.start);
        this.end.set(...config.end);
        this.updateProxy();
        this.updateProfile();
    }

    public override onFixtureValueUpdate(data: Color[] | Uint8Array): void {
        const colors = toPixelBytes(data);
        const source = this.segmentSource;
        source.colors = colors;
        if (source.worldPositions.length !== colors.length) {
            source.worldPositions = new Float32Array(colors.length);
            source.worldNormals = new Float32Array(colors.length);
        }
    }

    /** Pixel positions (evenly between start and end) and the emission direction (local +Y) in world space. */
    public override updateWorld(): void {
        const source = this.segmentSource;
        source.visible = isInVisibleHierarchy(this);
        const pixels = source.colors.length / 3;
        if (!source.visible || pixels === 0) {
            return;
        }
        const positions = source.worldPositions;
        const normals = source.worldNormals;
        const normal = this.tmpNormal.copy(PLUS_Y).applyNormalMatrix(this.worldNormalMatrix.getNormalMatrix(this.matrixWorld));
        for (let i = 0; i < pixels; i++) {
            const p = this.tmpPoint
                .copy(this.start)
                .lerp(this.end, (i + 0.5) / pixels)
                .applyMatrix4(this.matrixWorld);
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
            normals[i * 3] = normal.x;
            normals[i * 3 + 1] = normal.y;
            normals[i * 3 + 2] = normal.z;
        }
    }

    /** Only the emission direction arrow; the profile body itself is pickable. */
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

    /** The strip's model, or the default LED strip body for unknown or unsuitable ids. */
    private resolveStripModel(): FixtureAssetDefinition {
        const def = assetCatalog.get(this.modelId);
        if (
            def?.category === "fixtures" &&
            def.fixture.visualizationTypes.includes(VisualizationType.LED_STRIP) &&
            def.source.type === "parametric" &&
            !assetCatalog.isInvalid(def.id)
        ) {
            return def;
        }
        return assetCatalog.defaultModelFor(VisualizationType.LED_STRIP);
    }

    /** (Re)builds the profile body for the current model and length, then places it between start and end. */
    private updateProfile() {
        if (!this.modelId || this.disposed) {
            return;
        }
        const definition = this.resolveStripModel();
        const params: ParamValues = definition.source.type === "parametric" ? { length: roundedLength(this.start.distanceTo(this.end)) } : {};
        const spec = { assetId: definition.id, params };
        // the cache completes and clamps the params; the key uses the same values
        const key = templateKey(definition.id, params, null, null, null);
        if (key === this.profileKey) {
            this.pendingKey = null;
            this.request++;
            this.placeProfile();
            return;
        }
        if (key === this.pendingKey) {
            return;
        }
        if (this.pendingKey && this.pendingKey !== this.profileKey) {
            this.inputs.assets.release(this.pendingKey, this.uuid);
        }
        this.pendingKey = key;
        const request = ++this.request;
        void this.inputs.assets.acquire(spec, this.uuid).then((template) => {
            if (request !== this.request || this.disposed) {
                return;
            }
            this.pendingKey = null;
            if (!template) {
                this.inputs.assets.release(key, this.uuid);
                return;
            }
            this.releaseProfile();
            this.profile = instantiate(template);
            this.profile.name = "ledProfile";
            this.profileKey = key;
            this.add(this.profile);
            this.placeProfile();
        });
    }

    /** Midpoint of start/end, +X along the strip, +Y (diffuser) as close to the local +Y as the strip allows. */
    private placeProfile() {
        const profile = this.profile;
        if (!profile) {
            return;
        }
        profile.position.copy(this.start).add(this.end).multiplyScalar(0.5);
        const x = this.end.clone().sub(this.start);
        if (x.lengthSq() < 1e-12) {
            profile.quaternion.identity();
            return;
        }
        x.normalize();
        // emission direction made orthogonal to the strip; a strip along Y uses +Z instead
        const reference = Math.abs(x.dot(PLUS_Y)) > 0.999 ? PLUS_Z : PLUS_Y;
        const y = reference.clone().sub(x.clone().multiplyScalar(reference.dot(x))).normalize();
        const z = new THREE.Vector3().crossVectors(x, y);
        profile.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    }

    private releaseProfile() {
        if (this.profile) {
            this.profile.removeFromParent();
            this.profile = null;
        }
        if (this.profileKey) {
            this.inputs.assets.release(this.profileKey, this.uuid);
            this.profileKey = null;
        }
    }

    private updateProxy() {
        if (!this.proxy) {
            return;
        }
        const arrow = this.proxy.getObjectByName("arrow") as THREE.Mesh;
        // arrow shows the emission direction (local +Y) at the strip center
        arrow.position.copy(this.start).add(this.end).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.1, 0));
    }
}
