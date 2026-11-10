import * as THREE from "three";

import { assetCatalog } from "@/assetLibrary/catalog";
import { templateKey, type AssetCache } from "@/assetLibrary/assetCache";
import { FixtureBody } from "@/assetLibrary/fixtureBody";
import type { FixtureAssetDefinition } from "@/assetLibrary/types";
import { validateAsset } from "@/assetLibrary/validate";
import { VisualizationType } from "../fixtureVisualization";
import type { SurfaceLighting } from "../lighting/surfaceLighting";

export interface RendererInputs {
    camera: THREE.Camera;
    lighting: SurfaceLighting;
    /** Asset templates of the view (feature 002). */
    assets: AssetCache;
}

/** Fixture models that already passed (true) or failed (false) the runtime safety net (research R10, point 3). */
const runtimeChecked = new Map<string, boolean>();

function passesRuntimeCheck(definition: FixtureAssetDefinition, template: THREE.Object3D): boolean {
    let ok = runtimeChecked.get(definition.id);
    if (ok === undefined) {
        const errors = validateAsset(definition, template).filter((i) => i.severity === "error");
        ok = errors.length === 0;
        runtimeChecked.set(definition.id, ok);
        if (!ok) {
            console.error(`[asset-library] fixture model "${definition.id}" failed validation; the generic fixture is used instead`, errors);
            assetCatalog.markInvalid(definition.id);
        }
    }
    return ok;
}

/** Template key of a fixture body (bodies use no params, variant, material or color). */
function bodyKey(modelId: string): string {
    return templateKey(modelId, null, null, null, null);
}

/**
 * Renderer of one fixture visualization. It draws at the local origin of its parent: placement comes from the
 * scene object's transform, never from the config.
 */
export abstract class BaseRenderer<C = unknown, V = unknown> extends THREE.Group {
    /** The current fixture body, once its template is loaded. */
    protected body: FixtureBody | null = null;
    /** Template key of `body`. */
    private bodyTemplateKey: string | null = null;
    /** Template key of the newest pending `loadBody` request. */
    private pendingBodyKey: string | null = null;
    private bodyRequest = 0;
    private rendererDisposed = false;

    public constructor(protected readonly inputs: RendererInputs) {
        super();
    }
    public abstract onConfigUpdate(c: C): void;
    public abstract onFixtureValueUpdate(v: V): void;

    /**
     * Called by the view after the renderer is created and whenever `modelId` or `modelScale` of the object changes.
     * @virtual
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    public onModelUpdate(_modelId: string, _modelScale: number): void {}

    /**
     * Called when a body built by `loadBody` replaced the previous one. The body is not yet added to the renderer.
     * @virtual
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    protected onBodyReady(_body: FixtureBody): void {}

    /**
     * Loads the body of `modelId` (unknown, invalid or non-fixture ids fall back to the generic fixture) and calls
     * `onBodyReady` when it is built. Results of an older request are discarded.
     */
    protected loadBody(modelId: string): void {
        const definition = this.resolveModel(modelId);
        const key = bodyKey(definition.id);
        const request = ++this.bodyRequest;
        if (key === this.bodyTemplateKey) {
            // the current body already shows this model; drop any newer pending request
            this.pendingBodyKey = null;
            return;
        }
        this.pendingBodyKey = key;
        void this.inputs.assets.acquire({ assetId: definition.id }, this.uuid).then((template) => {
            const stale = request !== this.bodyRequest || this.rendererDisposed;
            if (stale) {
                if (key !== this.bodyTemplateKey && key !== this.pendingBodyKey) {
                    this.inputs.assets.release(key, this.uuid);
                }
                return;
            }
            this.pendingBodyKey = null;
            if (!template || !passesRuntimeCheck(definition, template)) {
                this.inputs.assets.release(key, this.uuid);
                if (!template) {
                    console.error(`[asset-library] fixture model "${definition.id}" could not be loaded`);
                    assetCatalog.markInvalid(definition.id);
                }
                const fallback = assetCatalog.defaultModelFor(VisualizationType.GENERIC);
                if (fallback.id !== definition.id) {
                    this.loadBody(fallback.id);
                }
                return;
            }
            const body = new FixtureBody(definition, template);
            this.releaseBody();
            this.body = body;
            this.bodyTemplateKey = key;
            this.onBodyReady(body);
        });
    }

    /** Removes and frees the current body and releases its template. */
    protected releaseBody() {
        if (this.body) {
            this.body.removeFromParent();
            this.body.dispose();
            this.body = null;
        }
        if (this.bodyTemplateKey) {
            this.inputs.assets.release(this.bodyTemplateKey, this.uuid);
            this.bodyTemplateKey = null;
        }
    }

    private resolveModel(modelId: string): FixtureAssetDefinition {
        const definition = assetCatalog.get(modelId);
        if (definition?.category === "fixtures" && !assetCatalog.isInvalid(definition.id)) {
            return definition;
        }
        const fallback = assetCatalog.defaultModelFor(VisualizationType.GENERIC);
        if (definition?.id !== fallback.id) {
            console.warn(`[asset-library] fixture model "${modelId}" is unknown, invalid or not a fixture; using "${fallback.id}"`);
        }
        return fallback;
    }

    /**
     * Editor-only helper geometry for fixtures without a pickable body (it is put on the editor layer by the view).
     * @virtual
     */
    public createEditorProxy(): THREE.Object3D | null {
        return null;
    }

    /**
     * Called once per frame after the scene graph's world matrices are up to date.
     * @virtual
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public updateWorld(): void {}

    /**
     * Renderers with a real SpotLight return it, so the view can cap the number of real lights (research R15).
     * @virtual
     */
    public getSurfaceLight(): THREE.Light | null {
        return null;
    }

    /**
     * Subclasses that override this must call `super.dispose()`, which releases the body template.
     * @virtual
     */
    public dispose() {
        this.rendererDisposed = true;
        this.bodyRequest++;
        if (this.pendingBodyKey && this.pendingBodyKey !== this.bodyTemplateKey) {
            this.inputs.assets.release(this.pendingBodyKey, this.uuid);
        }
        this.pendingBodyKey = null;
        this.releaseBody();
    }
}
