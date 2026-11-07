import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";

import type { CameraPose, SceneObject, SceneSnapshot } from "@/scene/model/types";
import { isFixtureVisualization, isImportedModel } from "@/scene/model/types";
import { isEffectivelyVisible } from "@/scene/model/transformMath";
import { VisualizationType } from "./fixtureVisualization";
import type { BaseRenderer, RendererInputs } from "./fixtureVisualizations/base.renderer";
import { LedStripRenderer } from "./fixtureVisualizations/ledStrip/ledStrip.renderer";
import { SpotRenderer } from "./fixtureVisualizations/spot/spot.renderer";
import { MovingHeadRenderer } from "./fixtureVisualizations/movingHead/movingHead.renderer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { UnrealBloomPass } from "./bloom";
import { convertToLedLit, LedStripLighting } from "./ledLitMaterial";
import { buildObject3D, createPlaceholder, disposeObject3D, SCENE_OBJECT_ID, updateObject3D } from "./objectBuilders";

/** Objects that only exist for editing (grid, handles, proxies) are put on this layer. */
export const EDITOR_LAYER = 1;

/** Real SpotLights per view; further spots and moving heads keep their beam but light no surfaces (research R15). */
export const MAX_REAL_SPOTLIGHTS = 16;

export interface SceneViewOptions {
    showEditorProxies: boolean;
}

type RendererConstructor = new (inputs: RendererInputs) => BaseRenderer;

const RENDERER_TYPES: Record<VisualizationType, RendererConstructor> = {
    [VisualizationType.LED_STRIP]: LedStripRenderer,
    [VisualizationType.SPOT]: SpotRenderer,
    [VisualizationType.MOVING_HEAD]: MovingHeadRenderer,
};

interface FixtureEntry {
    type: VisualizationType;
    renderer: BaseRenderer;
    proxy: THREE.Object3D | null;
    configKey: string;
}

/** A parsed GLB asset (materials converted to LED-lit ones), shared by all objects that use it. */
interface ModelCacheEntry {
    state: "loading" | "ready" | "failed";
    scene: THREE.Object3D | null;
    users: Set<string>;
}

function disposeModelScene(scene: THREE.Object3D | null) {
    scene?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
                for (const value of Object.values(material)) {
                    if (value instanceof THREE.Texture) {
                        value.dispose();
                    }
                }
                material.dispose();
            }
        }
    });
}

interface ViewEntry {
    data: SceneObject;
    o3d: THREE.Object3D;
    fixture?: FixtureEntry;
}

export class SceneView {
    public readonly scene = new THREE.Scene();
    /** All scene objects hang below this group. */
    public readonly root = new THREE.Group();
    public readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1000);
    public readonly lighting = new LedStripLighting();
    public readonly renderer: THREE.WebGLRenderer;

    private readonly composer: EffectComposer;
    private readonly bloomPass: UnrealBloomPass;
    private readonly entries = new Map<string, ViewEntry>();
    /** states of all objects, needed for effective visibility */
    private readonly states: { objects: Record<string, SceneObject> } = { objects: {} };
    private readonly assets = new Map<string, Uint8Array>();
    private readonly models = new Map<string, ModelCacheEntry>();
    private readonly fixtureValues = new Map<string, unknown>();
    private readonly fixtureConfigs = new Map<string, unknown>();
    private readonly beforeRenderCallbacks = new Set<() => void>();
    private readonly afterRenderCallbacks = new Set<() => void>();
    private animationFrame = 0;
    private disposed = false;

    public constructor(public readonly canvas: HTMLCanvasElement, private readonly options: SceneViewOptions) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 4;

        this.scene.add(this.root);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x909090, 1.2));
        if (options.showEditorProxies) {
            this.camera.layers.enable(EDITOR_LAYER);
        }

        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(4096, 4096), 0.3, 0.0, 0.5);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());

        this.render();
    }

    // -----------------------------------------------------------------------------------------------------------
    // Scene state

    /** Full rebuild. */
    public setScene(state: SceneSnapshot) {
        this.clear();
        this.applyObjects(Object.values(state.objects));
    }

    /** Creates or updates the given objects (full states) and re-parents the Object3Ds to match `parentId`. */
    public applyObjects(objects: SceneObject[]) {
        for (const obj of objects) {
            this.states.objects[obj.id] = obj;
            let entry = this.entries.get(obj.id);
            if (entry && !updateObject3D(entry.o3d, obj, this)) {
                this.disposeEntry(entry);
                entry = undefined;
            }
            if (!entry) {
                const o3d = buildObject3D(obj, this);
                entry = { data: obj, o3d };
                this.entries.set(obj.id, entry);
            }
            entry.data = obj;
            this.syncFixture(entry);
            this.syncModel(entry);
        }

        for (const obj of objects) {
            const entry = this.entries.get(obj.id)!;
            const parent = (obj.parentId && this.entries.get(obj.parentId)?.o3d) || this.root;
            if (entry.o3d.parent !== parent) {
                parent.add(entry.o3d);
            }
        }
        this.refreshVisibility();
    }

    public removeObjects(ids: string[]) {
        for (const id of ids) {
            const entry = this.entries.get(id);
            if (!entry) {
                continue;
            }
            // surviving children must not be disposed with their parent
            for (const child of [...entry.o3d.children]) {
                if (child.userData[SCENE_OBJECT_ID] && !ids.includes(child.userData[SCENE_OBJECT_ID] as string)) {
                    this.root.add(child);
                }
            }
            this.disposeEntry(entry);
            this.entries.delete(id);
            Reflect.deleteProperty(this.states.objects, id);
            this.fixtureValues.delete(id);
            this.fixtureConfigs.delete(id);
        }
        this.refreshVisibility();
    }

    public setAsset(assetId: string, data: ArrayBuffer | Uint8Array) {
        this.assets.set(assetId, data instanceof Uint8Array ? data : new Uint8Array(data));
        // objects that were waiting for their data show the model now
        for (const entry of this.entries.values()) {
            if (isImportedModel(entry.data) && entry.data.assetId === assetId) {
                this.syncModel(entry);
            }
        }
    }

    public setFixtureConfig(objectId: string, config: unknown) {
        this.fixtureConfigs.set(objectId, config);
        const fixture = this.entries.get(objectId)?.fixture;
        if (fixture) {
            fixture.renderer.onConfigUpdate(config);
            fixture.renderer.onFixtureValueUpdate(this.fixtureValues.get(objectId) ?? []);
        }
    }

    public setFixtureValue(objectId: string, value: unknown) {
        this.fixtureValues.set(objectId, value);
        this.entries.get(objectId)?.fixture?.renderer.onFixtureValueUpdate(value ?? []);
    }

    // -----------------------------------------------------------------------------------------------------------
    // Camera and access

    public setCameraPose(pose: CameraPose) {
        this.camera.position.set(...pose.position);
        this.camera.fov = pose.fov;
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(new THREE.Vector3(...pose.target));
        this.camera.updateProjectionMatrix();
    }

    public getCamera() {
        return this.camera;
    }

    public getRoot() {
        return this.root;
    }

    public getObject3D(id: string): THREE.Object3D | undefined {
        return this.entries.get(id)?.o3d;
    }

    public getSceneObject(id: string): SceneObject | undefined {
        return this.entries.get(id)?.data;
    }

    public getObjectIds(): string[] {
        return [...this.entries.keys()];
    }

    public resize(width: number, height: number) {
        if (width <= 0 || height <= 0) {
            return;
        }
        this.renderer.setSize(width, height, false);
        this.composer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    public onBeforeRender(cb: () => void) {
        this.beforeRenderCallbacks.add(cb);
        return () => this.beforeRenderCallbacks.delete(cb);
    }

    public onAfterRender(cb: () => void) {
        this.afterRenderCallbacks.add(cb);
        return () => this.afterRenderCallbacks.delete(cb);
    }

    // -----------------------------------------------------------------------------------------------------------
    // Lifecycle

    /** research R12: frees everything this view created. */
    public dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        cancelAnimationFrame(this.animationFrame);
        this.clear();
        this.beforeRenderCallbacks.clear();
        this.afterRenderCallbacks.clear();
        this.lighting.dispose();
        this.bloomPass.dispose();
        this.composer.dispose();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
    }

    private clear() {
        for (const entry of this.entries.values()) {
            this.disposeEntry(entry);
        }
        this.entries.clear();
        this.states.objects = {};
        this.fixtureValues.clear();
        this.fixtureConfigs.clear();
    }

    private disposeEntry(entry: ViewEntry) {
        if (entry.fixture) {
            this.removeFixtureRenderer(entry);
        }
        this.releaseModel(entry);
        entry.o3d.removeFromParent();
        disposeObject3D(entry.o3d);
    }

    private removeFixtureRenderer(entry: ViewEntry) {
        const fixture = entry.fixture;
        if (!fixture) {
            return;
        }
        fixture.renderer.removeFromParent();
        if (fixture.proxy) {
            fixture.proxy.removeFromParent();
            fixture.proxy.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.geometry.dispose();
                    (o.material as THREE.Material).dispose();
                }
            });
        }
        fixture.renderer.dispose();
        entry.fixture = undefined;
    }

    private syncFixture(entry: ViewEntry) {
        const obj = entry.data;
        if (!isFixtureVisualization(obj)) {
            return;
        }

        if (entry.fixture && entry.fixture.type !== obj.visualizationType) {
            this.removeFixtureRenderer(entry);
        }

        if (!entry.fixture) {
            const Ctor = RENDERER_TYPES[obj.visualizationType];
            if (!Ctor) {
                console.error(`No renderer for visualization type ${obj.visualizationType}`);
                return;
            }
            try {
                const renderer = new Ctor({ camera: this.camera, lighting: this.lighting });
                (renderer as { isFixtureRenderer?: boolean }).isFixtureRenderer = true;
                let proxy: THREE.Object3D | null = null;
                if (this.options.showEditorProxies) {
                    proxy = renderer.createEditorProxy();
                    if (proxy) {
                        proxy.traverse((o) => o.layers.set(EDITOR_LAYER));
                        renderer.add(proxy);
                    }
                }
                entry.o3d.add(renderer);
                entry.fixture = { type: obj.visualizationType, renderer, proxy, configKey: "" };
            } catch (err) {
                console.error(`Could not create renderer for "${obj.name}"`, err);
                return;
            }
        }

        const fixture = entry.fixture;
        const configKey = JSON.stringify(obj.config);
        if (fixture.configKey !== configKey) {
            fixture.configKey = configKey;
            // a controller-provided config (linked fixture) wins until the object's config changes
            this.fixtureConfigs.delete(obj.id);
            fixture.renderer.onConfigUpdate(obj.config);
            fixture.renderer.onFixtureValueUpdate(this.fixtureValues.get(obj.id) ?? []);
        } else if (this.fixtureConfigs.has(obj.id)) {
            // keep the value in sync after a replaced renderer
            fixture.renderer.onFixtureValueUpdate(this.fixtureValues.get(obj.id) ?? []);
        }
    }

    /** Shows the parsed model once the asset bytes are available (a loading placeholder until then). */
    private syncModel(entry: ViewEntry) {
        const obj = entry.data;
        if (!isImportedModel(obj)) {
            return;
        }
        let cache = this.models.get(obj.assetId);
        if (!cache) {
            const data = this.assets.get(obj.assetId);
            if (!data) {
                return;
            }
            cache = { state: "loading", scene: null, users: new Set() };
            this.models.set(obj.assetId, cache);
            void this.parseModel(obj.assetId, data, cache);
        }
        cache.users.add(obj.id);
        if (cache.state !== "loading") {
            this.attachModel(entry, cache);
        }
    }

    private async parseModel(assetId: string, data: Uint8Array, cache: ModelCacheEntry) {
        try {
            const copy = data.slice();
            const gltf = await new GLTFLoader().parseAsync(copy.buffer, "");
            gltf.scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = Array.isArray(child.material)
                        ? child.material.map((m: THREE.Material) => convertToLedLit(this.lighting, m))
                        : convertToLedLit(this.lighting, child.material);
                }
            });
            cache.scene = gltf.scene;
            cache.state = "ready";
        } catch (err) {
            // FR-061: the rest of the scene is not affected
            console.error(`Could not parse model ${assetId}`, err);
            cache.state = "failed";
        }
        if (this.disposed || this.models.get(assetId) !== cache) {
            disposeModelScene(cache.scene);
            return;
        }
        for (const id of cache.users) {
            const entry = this.entries.get(id);
            if (entry) {
                this.attachModel(entry, cache);
            }
        }
    }

    private attachModel(entry: ViewEntry, cache: ModelCacheEntry) {
        if (entry.o3d.userData.modelAttached === cache) {
            return;
        }
        this.clearModelContent(entry.o3d);
        if (cache.state === "ready" && cache.scene) {
            // clones share geometry, materials and textures with the cached scene
            const clone = cache.scene.clone(true);
            clone.userData.sharedResources = true;
            entry.o3d.add(clone);
        } else {
            entry.o3d.add(createPlaceholder("Model could not be loaded"));
        }
        entry.o3d.userData.modelAttached = cache;
    }

    /** Removes the placeholder or model clone of an imported model object. */
    private clearModelContent(o3d: THREE.Object3D) {
        for (const child of [...o3d.children]) {
            if (child.userData[SCENE_OBJECT_ID] || (child as { isFixtureRenderer?: boolean }).isFixtureRenderer) {
                continue;
            }
            child.removeFromParent();
            if (!child.userData.sharedResources) {
                disposeObject3D(child);
            }
        }
    }

    private releaseModel(entry: ViewEntry) {
        const obj = entry.data;
        if (!isImportedModel(obj)) {
            return;
        }
        const cache = this.models.get(obj.assetId);
        if (!cache) {
            return;
        }
        cache.users.delete(obj.id);
        if (cache.users.size === 0) {
            // the last object using the asset is gone
            this.models.delete(obj.assetId);
            disposeModelScene(cache.scene);
        }
    }

    private refreshVisibility() {
        for (const [id, entry] of this.entries) {
            entry.o3d.visible = isEffectivelyVisible(this.states, id);
        }
        this.updateLightBudget();
    }

    /** Only the first MAX_REAL_SPOTLIGHTS visible spots/moving heads keep their real light. */
    private updateLightBudget() {
        let used = 0;
        for (const entry of this.entries.values()) {
            const light = entry.fixture?.renderer.getSurfaceLight();
            if (!light) {
                continue;
            }
            if (!entry.o3d.visible) {
                light.visible = true;
                continue;
            }
            light.visible = used < MAX_REAL_SPOTLIGHTS;
            used++;
        }
    }

    private render() {
        if (this.disposed) {
            return;
        }
        this.animationFrame = requestAnimationFrame(() => this.render());

        for (const cb of this.beforeRenderCallbacks) {
            cb();
        }
        this.scene.updateMatrixWorld();
        for (const entry of this.entries.values()) {
            entry.fixture?.renderer.updateWorld();
        }
        this.lighting.update();
        this.composer.render();
        for (const cb of this.afterRenderCallbacks) {
            cb();
        }
    }
}
