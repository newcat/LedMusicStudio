import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";

import type { CameraPose, SceneEnvironment, SceneObject, SceneSnapshot } from "@/scene/model/types";
import { isFixtureVisualization, isImportedModel, isLibraryAsset, isShape } from "@/scene/model/types";
import { AssetCache, instantiate, templateKey } from "@/assetLibrary/assetCache";
import { assetCatalog } from "@/assetLibrary/catalog";
import { isEffectivelyVisible } from "@/scene/model/transformMath";
import { VisualizationType } from "./fixtureVisualization";
import type { BaseRenderer, FrameContext, RendererInputs } from "./fixtureVisualizations/base.renderer";
import { LedStripRenderer } from "./fixtureVisualizations/ledStrip/ledStrip.renderer";
import { BeamRenderer } from "./fixtureVisualizations/beam/beam.renderer";
import { GenericRenderer } from "./fixtureVisualizations/generic/generic.renderer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { UnrealBloomPass } from "./bloom";
import { convertToLedLit } from "./ledLitMaterial";
import { SurfaceLighting } from "./lighting/surfaceLighting";
import { DEFAULT_ENVIRONMENT, EnvironmentState } from "./environment";
import { QUALITY_PROFILES, type FallbackNotice, type QualityLevel, type QualityProfile, type ViewKind } from "./quality";
import { buildObject3D, createPlaceholder, disposeObject3D, SCENE_OBJECT_ID, updateObject3D } from "./objectBuilders";

/** Objects that only exist for editing (grid, handles, proxies) are put on this layer. */
export const EDITOR_LAYER = 1;

/** Largest time step handed to renderers, in seconds. */
const MAX_FRAME_DT = 0.1;
/** Window of the rolling frame rate average, in milliseconds. */
const FPS_WINDOW_MS = 500;
const EMPTY_VALUE = new Uint8Array(0);

export interface SceneViewOptions {
    showEditorProxies: boolean;
    /** Selects quality preference and ambient setting. */
    kind: ViewKind;
}

export interface FrameStats {
    fps: number;
    frameMs: number;
}

type RendererConstructor = new (inputs: RendererInputs) => BaseRenderer;

const RENDERER_TYPES: Record<VisualizationType, RendererConstructor> = {
    [VisualizationType.LED_STRIP]: LedStripRenderer,
    [VisualizationType.SPOT]: BeamRenderer,
    [VisualizationType.MOVING_HEAD]: BeamRenderer,
    [VisualizationType.GENERIC]: GenericRenderer,
    // Placeholders until the effect renderers exist (feature 003, US5).
    [VisualizationType.LASER]: GenericRenderer,
    [VisualizationType.FLAME]: GenericRenderer,
    [VisualizationType.CO2_JET]: GenericRenderer,
    [VisualizationType.COLD_SPARK]: GenericRenderer,
    [VisualizationType.FOG]: GenericRenderer,
};

interface FixtureEntry {
    type: VisualizationType;
    renderer: BaseRenderer;
    proxy: THREE.Object3D | null;
    configKey: string;
    /** `modelId + ":" + modelScale`, re-sent to the renderer when it changes. */
    modelKey: string;
}

/** Template of a library asset object (feature 002). */
interface LibraryEntry {
    key: string;
    /** "loading" until the template is attached; "failed" shows the red placeholder. */
    state: "loading" | "ready" | "failed";
    /** stored size the placeholder was built with */
    placeholderSize: string;
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

/** Meshes below `o3d`, without descending into other scene objects or fixture renderers. */
function collectMeshes(o3d: THREE.Object3D, out: THREE.Object3D[], isRoot = false) {
    if (!isRoot && (o3d.userData[SCENE_OBJECT_ID] || (o3d as { isFixtureRenderer?: boolean }).isFixtureRenderer)) {
        return;
    }
    if (o3d instanceof THREE.Mesh) {
        out.push(o3d);
    }
    for (const child of o3d.children) {
        collectMeshes(child, out);
    }
}

interface ViewEntry {
    data: SceneObject;
    o3d: THREE.Object3D;
    fixture?: FixtureEntry;
    library?: LibraryEntry;
}

export class SceneView {
    public readonly scene = new THREE.Scene();
    /** All scene objects hang below this group. */
    public readonly root = new THREE.Group();
    public readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1000);
    public readonly lighting = new SurfaceLighting();
    public readonly environment = new EnvironmentState();
    public readonly renderer: THREE.WebGLRenderer;
    /** Templates of library assets and fixture bodies (feature 002). */
    public readonly assets: AssetCache;

    private readonly composer: EffectComposer;
    private readonly bloomPass: UnrealBloomPass;
    private readonly entries = new Map<string, ViewEntry>();
    /** states of all objects, needed for effective visibility */
    private readonly states: { objects: Record<string, SceneObject> } = { objects: {} };
    /** Bytes of imported models (001), by scene asset id. */
    private readonly modelData = new Map<string, Uint8Array>();
    private readonly models = new Map<string, ModelCacheEntry>();
    private readonly fixtureValues = new Map<string, Uint8Array>();
    private readonly fixtureConfigs = new Map<string, unknown>();
    /** FR-054: objects whose config (configDirty) or value (dirty) is applied at the start of the next frame. */
    private readonly dirty = new Set<string>();
    private readonly configDirty = new Set<string>();
    private readonly beforeRenderCallbacks = new Set<() => void>();
    private readonly afterRenderCallbacks = new Set<() => void>();
    private readonly activeCallbacks = new Set<(active: boolean) => void>();
    private readonly frameStatsCallbacks = new Set<(stats: FrameStats) => void>();
    private readonly noticeCallbacks = new Set<(notice: FallbackNotice) => void>();
    private animationFrame = 0;
    private disposed = false;
    private isActive = true;
    private quality: QualityProfile = QUALITY_PROFILES.medium;
    private flashLimit: number | null = null;
    /** Static meshes for renderer raycasts; null = rebuild on next access. */
    private raycastCache: THREE.Object3D[] | null = null;
    private readonly raycastTargets = () => this.getRaycastTargets();

    private readonly startTime = performance.now();
    private lastFrameTime = performance.now();
    private fps = 60;
    private statsWindowStart = performance.now();
    private statsFrames = 0;

    public constructor(public readonly canvas: HTMLCanvasElement, private readonly options: SceneViewOptions) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 4;
        this.assets = new AssetCache(this.lighting);

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

        this.scheduleFrame();
    }

    // -----------------------------------------------------------------------------------------------------------
    // Activity, quality and environment (FR-053, research R15)

    public get active(): boolean {
        return this.isActive;
    }

    /** Inactive views do not render; they only store the latest values and apply them once on re-activation. */
    public setActive(active: boolean) {
        if (this.disposed || active === this.isActive) {
            return;
        }
        this.isActive = active;
        // listeners first: a sink that turns active pushes the full fixture state, which is then applied below
        for (const cb of this.activeCallbacks) {
            cb(active);
        }
        if (active) {
            this.applyDirty();
            this.lastFrameTime = performance.now();
            this.statsWindowStart = this.lastFrameTime;
            this.statsFrames = 0;
            this.scheduleFrame();
        } else if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = 0;
        }
    }

    /** Fires whenever `active` changes. */
    public onActiveChange(cb: (active: boolean) => void) {
        this.activeCallbacks.add(cb);
        return () => this.activeCallbacks.delete(cb);
    }

    public setEnvironment(environment: SceneEnvironment) {
        this.environment.setSettings(environment);
    }

    public setQuality(level: QualityLevel) {
        this.quality = QUALITY_PROFILES[level] ?? QUALITY_PROFILES.medium;
    }

    /** Strobe limit from the preferences (research R5); null = unlimited. */
    public setFlashLimit(limitHz: number | null) {
        this.flashLimit = limitHz;
    }

    /** Rolling frame rate (500 ms window), reported every 500 ms while active. */
    public onFrameStats(cb: (stats: FrameStats) => void) {
        this.frameStatsCallbacks.add(cb);
        return () => this.frameStatsCallbacks.delete(cb);
    }

    /** Features downgraded on this device (research R12, FR-055). */
    public onNotice(cb: (notice: FallbackNotice) => void) {
        this.noticeCallbacks.add(cb);
        return () => this.noticeCallbacks.delete(cb);
    }

    // -----------------------------------------------------------------------------------------------------------
    // Scene state

    /** Full rebuild. */
    public setScene(state: SceneSnapshot) {
        // snapshots of older main windows may lack the environment
        this.setEnvironment(state.environment ?? DEFAULT_ENVIRONMENT);
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
            this.syncLibraryAsset(entry);
        }

        for (const obj of objects) {
            const entry = this.entries.get(obj.id)!;
            const parent = (obj.parentId && this.entries.get(obj.parentId)?.o3d) || this.root;
            if (entry.o3d.parent !== parent) {
                parent.add(entry.o3d);
            }
        }
        this.raycastCache = null;
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
            this.dirty.delete(id);
            this.configDirty.delete(id);
        }
        this.raycastCache = null;
        this.refreshVisibility();
    }

    public setAsset(assetId: string, data: ArrayBuffer | Uint8Array) {
        this.modelData.set(assetId, data instanceof Uint8Array ? data : new Uint8Array(data));
        // objects that were waiting for their data show the model now
        for (const entry of this.entries.values()) {
            if (isImportedModel(entry.data) && entry.data.assetId === assetId) {
                this.syncModel(entry);
            }
        }
    }

    /** Stores the config; it is applied at the start of the next frame (FR-054). */
    public setFixtureConfig(objectId: string, config: unknown) {
        this.fixtureConfigs.set(objectId, config);
        this.configDirty.add(objectId);
        this.dirty.add(objectId);
    }

    /** Stores the value; it is applied at most once, at the start of the next frame (FR-054). */
    public setFixtureValue(objectId: string, value: Uint8Array) {
        this.fixtureValues.set(objectId, value);
        this.dirty.add(objectId);
    }

    /** Static meshes (shapes, library assets, imported models) for beam-length and laser raycasts (research R11). */
    public getRaycastTargets(): readonly THREE.Object3D[] {
        if (!this.raycastCache) {
            const targets: THREE.Object3D[] = [];
            for (const entry of this.entries.values()) {
                const obj = entry.data;
                if (isShape(obj) || isLibraryAsset(obj) || isImportedModel(obj)) {
                    collectMeshes(entry.o3d, targets, true);
                }
            }
            this.raycastCache = targets;
        }
        return this.raycastCache;
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
        this.assets.dispose();
        this.beforeRenderCallbacks.clear();
        this.afterRenderCallbacks.clear();
        this.activeCallbacks.clear();
        this.frameStatsCallbacks.clear();
        this.noticeCallbacks.clear();
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
        this.dirty.clear();
        this.configDirty.clear();
        this.raycastCache = null;
    }

    private disposeEntry(entry: ViewEntry) {
        if (entry.fixture) {
            this.removeFixtureRenderer(entry);
        }
        this.releaseModel(entry);
        this.releaseLibraryAsset(entry);
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
                const renderer = new Ctor({
                    camera: this.camera,
                    assets: this.assets,
                    lighting: this.lighting,
                    environment: this.environment,
                    raycastTargets: this.raycastTargets,
                });
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
                entry.fixture = { type: obj.visualizationType, renderer, proxy, configKey: "", modelKey: "" };
                // a new renderer needs the config and the latest value
                this.configDirty.add(obj.id);
                this.dirty.add(obj.id);
            } catch (err) {
                console.error(`Could not create renderer for "${obj.name}"`, err);
                return;
            }
        }

        const fixture = entry.fixture;
        const modelKey = `${obj.modelId}:${obj.modelScale}`;
        if (fixture.modelKey !== modelKey) {
            fixture.modelKey = modelKey;
            fixture.renderer.onModelUpdate(obj.modelId, obj.modelScale);
        }
        const configKey = JSON.stringify(obj.config);
        if (fixture.configKey !== configKey) {
            fixture.configKey = configKey;
            // a controller-provided config (linked fixture) wins until the object's config changes
            this.fixtureConfigs.delete(obj.id);
            this.configDirty.add(obj.id);
            this.dirty.add(obj.id);
        }
    }

    /** FR-054: applies stored configs, then values, of all dirty fixtures once. */
    private applyDirty() {
        if (this.dirty.size === 0) {
            return;
        }
        for (const id of this.dirty) {
            const entry = this.entries.get(id);
            const renderer = entry?.fixture?.renderer;
            if (!entry || !renderer) {
                continue;
            }
            if (this.configDirty.has(id)) {
                const config = this.fixtureConfigs.has(id) ? this.fixtureConfigs.get(id) : (entry.data as { config?: unknown }).config;
                renderer.onConfigUpdate(config);
            }
            renderer.onFixtureValueUpdate(this.fixtureValues.get(id) ?? EMPTY_VALUE);
        }
        this.dirty.clear();
        this.configDirty.clear();
    }

    /** Shows the parsed model once the asset bytes are available (a loading placeholder until then). */
    private syncModel(entry: ViewEntry) {
        const obj = entry.data;
        if (!isImportedModel(obj)) {
            return;
        }
        let cache = this.models.get(obj.assetId);
        if (!cache) {
            const data = this.modelData.get(obj.assetId);
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
        // the content is replaced right after this, so the raycast list must be rebuilt
        this.raycastCache = null;
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

    /**
     * Shows the template of a library asset (feature 002). The template is re-acquired whenever asset, params,
     * variant, material or color change; unknown assets and failed loads show a red placeholder (FR-070).
     */
    private syncLibraryAsset(entry: ViewEntry) {
        const obj = entry.data;
        if (!isLibraryAsset(obj)) {
            return;
        }
        const key = templateKey(obj.assetId, obj.params, obj.variant, obj.material, obj.color);
        const current = entry.library;
        if (current && current.key === key) {
            if (current.state !== "ready" && current.placeholderSize !== JSON.stringify(obj.size)) {
                this.showLibraryPlaceholder(entry, current);
            }
            return;
        }
        this.releaseLibraryAsset(entry);

        const definition = assetCatalog.get(obj.assetId);
        const library: LibraryEntry = { key, state: "loading", placeholderSize: "" };
        entry.library = library;
        if (!definition || definition.source.type === "shape") {
            library.state = "failed";
            this.showLibraryPlaceholder(entry, library);
            return;
        }
        this.showLibraryPlaceholder(entry, library);
        const objectId = obj.id;
        void this.assets
            .acquire({ assetId: obj.assetId, params: obj.params, variant: obj.variant, material: obj.material, color: obj.color }, objectId)
            .then((template) => {
                if (this.disposed || entry.library !== library || this.entries.get(objectId) !== entry) {
                    return;
                }
                if (!template) {
                    library.state = "failed";
                    this.showLibraryPlaceholder(entry, library);
                    return;
                }
                this.clearModelContent(entry.o3d);
                entry.o3d.add(instantiate(template));
                library.state = "ready";
            });
    }

    private showLibraryPlaceholder(entry: ViewEntry, library: LibraryEntry) {
        const obj = entry.data;
        if (!isLibraryAsset(obj)) {
            return;
        }
        this.clearModelContent(entry.o3d);
        const placeholder =
            library.state === "failed"
                ? createPlaceholder(`Unknown asset: ${obj.assetId}`, 0xff3030, obj.size)
                : createPlaceholder("Loading asset…", 0x909090, obj.size);
        entry.o3d.add(placeholder);
        library.placeholderSize = JSON.stringify(obj.size);
    }

    private releaseLibraryAsset(entry: ViewEntry) {
        if (!entry.library) {
            return;
        }
        this.assets.release(entry.library.key, entry.data.id);
        entry.library = undefined;
    }

    private refreshVisibility() {
        for (const [id, entry] of this.entries) {
            entry.o3d.visible = isEffectivelyVisible(this.states, id);
        }
    }

    /** The render loop only runs while the view is active (FR-053). */
    private scheduleFrame() {
        if (this.disposed || !this.isActive || this.animationFrame) {
            return;
        }
        this.animationFrame = requestAnimationFrame(this.onAnimationFrame);
    }

    private readonly onAnimationFrame = () => {
        this.animationFrame = 0;
        if (this.disposed || !this.isActive) {
            return;
        }
        this.scheduleFrame();
        this.renderFrame();
    };

    private renderFrame() {
        const now = performance.now();
        const dt = Math.min(MAX_FRAME_DT, Math.max(0, (now - this.lastFrameTime) / 1000));
        this.lastFrameTime = now;
        this.updateFrameStats(now);

        this.applyDirty();
        for (const cb of this.beforeRenderCallbacks) {
            cb();
        }
        this.scene.updateMatrixWorld();
        const frame: FrameContext = {
            time: (now - this.startTime) / 1000,
            dt,
            fps: this.fps,
            haze: this.environment.haze,
            flashLimit: this.flashLimit,
            quality: this.quality,
        };
        for (const entry of this.entries.values()) {
            entry.fixture?.renderer.update(frame);
        }
        this.lighting.update(this.camera, this.scene, this.renderer, this.quality);
        this.composer.render();
        for (const cb of this.afterRenderCallbacks) {
            cb();
        }
    }

    /** Rolling average over FPS_WINDOW_MS; subscribers are notified once per window. */
    private updateFrameStats(now: number) {
        this.statsFrames++;
        const elapsed = now - this.statsWindowStart;
        if (elapsed < FPS_WINDOW_MS) {
            return;
        }
        this.fps = (this.statsFrames * 1000) / elapsed;
        const stats: FrameStats = { fps: this.fps, frameMs: elapsed / this.statsFrames };
        this.statsWindowStart = now;
        this.statsFrames = 0;
        for (const cb of this.frameStatsCallbacks) {
            cb(stats);
        }
    }
}
