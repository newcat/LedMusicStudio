import * as THREE from "three";

import { assetCatalog } from "@/assetLibrary/catalog";
import { instantiate, templateKey } from "@/assetLibrary/assetCache";
import type { FixtureAssetDefinition, ParamValues } from "@/assetLibrary/types";
import { scaleColorArray } from "@/utils/scaleColorArray";
import { Color } from "@/graph/colors";
import type { LedStripSource } from "../../ledLitMaterial";
import { VisualizationType } from "../../fixtureVisualization";
import { BaseRenderer, RendererInputs } from "../base.renderer";
import type { LedStripVisualizationConfig } from "./types";

const RESOLUTION = 128;
const PLUS_Y = new THREE.Vector3(0, 1, 0);
const PLUS_Z = new THREE.Vector3(0, 0, 1);

/** Length parameter of the body, rounded to 1 cm to limit rebuilds. */
function roundedLength(length: number): number {
    return Math.round(length * 100) / 100;
}

/**
 * LED strip (feature 002, research R7): a parametric profile body between `start` and `end`, whose diffuser faces
 * the emission direction (the object's local +Y). The body is pickable; the editor proxy only shows the direction.
 */
export class LedStripRenderer extends BaseRenderer<LedStripVisualizationConfig, Color[]> implements LedStripSource {
    private readonly start = new THREE.Vector3(-0.5, 0, 0);
    private readonly end = new THREE.Vector3(0.5, 0, 0);
    private colors: Color[] = [];
    private proxy: THREE.Group | null = null;

    private modelId = "";
    private profile: THREE.Object3D | null = null;
    private profileKey: string | null = null;
    private pendingKey: string | null = null;
    private request = 0;
    private disposed = false;

    public constructor(inputs: RendererInputs) {
        super(inputs);
        inputs.lighting.addStrip(this);
    }

    public override dispose() {
        this.disposed = true;
        this.request++;
        this.inputs.lighting.removeStrip(this);
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

    public override onFixtureValueUpdate(data: Color[]): void {
        if (!data || data.length === 0) {
            this.colors = scaleColorArray([[0, 0, 0]], RESOLUTION);
            return;
        }

        this.colors = scaleColorArray(data, RESOLUTION);
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

    public getLocalStart(): THREE.Vector3 {
        return this.start;
    }

    public getLocalEnd(): THREE.Vector3 {
        return this.end;
    }

    public getColors(): Color[] {
        return this.colors;
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
