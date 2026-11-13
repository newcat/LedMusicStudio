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
import { LaserRenderer } from "./fixtureVisualizations/effects/laser/laser.renderer";
import { FlameRenderer } from "./fixtureVisualizations/effects/flame/flame.renderer";
import { Co2Renderer } from "./fixtureVisualizations/effects/co2/co2.renderer";
import { SparkRenderer } from "./fixtureVisualizations/effects/spark/spark.renderer";
import { FogRenderer } from "./fixtureVisualizations/effects/fog/fog.renderer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { UnrealBloomPass } from "./bloom";
import { convertToLedLit } from "./ledLitMaterial";
import { SurfaceLighting } from "./lighting/surfaceLighting";
import { ambientLight, DEFAULT_ENVIRONMENT, EnvironmentState } from "./environment";
import {
    applyFallbacks,
    detectDeviceSupport,
    FALLBACK_ORDER,
    fallbackNotice,
    QUALITY_PROFILES,
    type FallbackFeature,
    type FallbackNotice,
    type QualityLevel,
    type QualityProfile,
    type ViewKind,
} from "./quality";
import { MIN_TEXTURE_UNITS_FOR_SHADOWS, SHADOW_ATLAS_SIZE } from "./lighting/shadowAtlas";
import { buildObject3D, createPlaceholder, disposeObject3D, SCENE_OBJECT_ID, updateObject3D } from "./objectBuilders";
import { EDITOR_LAYER, NO_SHADOW_LAYER } from "./layers";

/**
 * `EDITOR_LAYER`: objects that only exist for editing (grid, handles, proxies).
 * `NO_SHADOW_LAYER`: objects that never cast shadows (beams, emitters, particles, strip pixels); research R11.
 * Both are defined in `layers.ts` so fixture bodies can use them without importing the view.
 */
export { EDITOR_LAYER, NO_SHADOW_LAYER };

/** Largest time step handed to renderers, in seconds. */
const MAX_FRAME_DT = 0.1;
/** Window of the rolling frame rate average, in milliseconds. */
const FPS_WINDOW_MS = 500;
const EMPTY_VALUE = new Uint8Array(0);
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const surfaceRaycaster = new THREE.Raycaster();
/** Bloom settings of the view: strength, radius, threshold. */
const BLOOM_STRENGTH = 0.3;
const BLOOM_RADIUS = 0.0;
const BLOOM_THRESHOLD = 0.5;

/** Fragment shader markers of the programs whose compile failure triggers a fallback step (T072). */
const FALLBACK_PROGRAM_MARKERS = [
    "uLightData", // surface lighting (LED-lit materials)
    "uHazeOctaves", // beams
];

function isFallbackFeature(value: string | null): value is FallbackFeature {
    return value !== null && (FALLBACK_ORDER as readonly string[]).includes(value);
}

/** Dev only (quickstart Q22): `?forceFallback=shadows|gobos|lights` simulates a device fallback. */
function forcedFallback(): FallbackFeature | null {
    if (!import.meta.env.DEV || typeof window === "undefined") {
        return null;
    }
    const value = new URLSearchParams(window.location.search).get("forceFallback");
    return isFallbackFeature(value) ? value : null;
}

/** Dev-only idle counters (T076, FR-053, SC-006): frames rendered by all views, fixture values handed to sinks. */
export interface VizStats {
    framesRendered: number;
    valuesPosted: number;
}

declare global {
    interface Window {
        __lmsVizStats?: VizStats;
    }
}

/** `window.__lmsVizStats`, created on first use; null outside dev builds. */
export function devVizStats(): VizStats | null {
    if (!import.meta.env.DEV || typeof window === "undefined") {
        return null;
    }
    return (window.__lmsVizStats ??= { framesRendered: 0, valuesPosted: 0 });
}

/** Result of `SceneView.raycastSurfaces`: world point and normal; `objectId` is null on the floor plane fallback. */
export interface SurfaceHit {
    point: THREE.Vector3;
    normal: THREE.Vector3;
    objectId: string | null;
}

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
    [VisualizationType.LASER]: LaserRenderer,
    [VisualizationType.FLAME]: FlameRenderer,
    [VisualizationType.CO2_JET]: Co2Renderer,
    [VisualizationType.COLD_SPARK]: SparkRenderer,
    [VisualizationType.FOG]: FogRenderer,
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
    /** Ambient of this view (T077); color and intensity follow `environment.ambientFor(options.kind)`. */
    private readonly hemisphereLight = new THREE.HemisphereLight(0x000000, 0x000000, 0);
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
    /** Profile of the selected level. */
    private baseQuality: QualityProfile = QUALITY_PROFILES.medium;
    /** Effective profile: `baseQuality` with the device fallbacks applied; handed to lighting and renderers. */
    private quality: QualityProfile = QUALITY_PROFILES.medium;
    /** Features downgraded on this device (FR-055); grows by one step per shader/render failure. */
    private readonly fallbacks = new Set<FallbackFeature>();
    /** Set by a shader or render failure; the next frame applies one fallback step. */
    private fallbackPending = false;
    private renderErrorLogged = false;
    /** Texture type of the composer and bloom targets (UnsignedByteType without float render targets). */
    private readonly targetType: THREE.TextureDataType;
    private appliedPixelRatio = 0;
    private appliedSamples = -1;
    private flashLimit: number | null = null;
    /** Static meshes for renderer raycasts; null = rebuild on next access. */
    private raycastCache: THREE.Object3D[] | null = null;
    /** Incremented whenever the raycast targets (and with them the static scene geometry) may have changed. */
    private raycastVersion = 0;
    private readonly raycastTargets = () => this.getRaycastTargets();
    private readonly raycastTargetsVersion = () => this.raycastVersion;
    /** Notices already reported; each is reported once per view. */
    private readonly reportedNotices = new Map<FallbackNotice["feature"], FallbackNotice>();

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
        this.scene.add(this.hemisphereLight);
        this.applyAmbient();
        // non-shadow-casting objects (beams, emitters, ...) are visible in every view; only shadow cameras skip them
        this.camera.layers.enable(NO_SHADOW_LAYER);
        if (options.showEditorProxies) {
            this.camera.layers.enable(EDITOR_LAYER);
        }
        this.lighting.onNotice = (notice) => this.reportNotice(notice);

        // device fallback (FR-055, research R12): limits checked once at view start
        const support = detectDeviceSupport(this.renderer);
        this.targetType = support.floatRenderTargets ? THREE.HalfFloatType : THREE.UnsignedByteType;
        if (!support.floatRenderTargets) {
            this.reportNotice(fallbackNotice("bloom"));
        }
        if (support.maxTextureUnits < MIN_TEXTURE_UNITS_FOR_SHADOWS || support.maxTextureSize < SHADOW_ATLAS_SIZE) {
            this.fallbacks.add("shadows");
            this.reportNotice(fallbackNotice("shadows"));
        }
        const forced = forcedFallback();
        if (forced) {
            this.fallbacks.add(forced);
            this.reportNotice(fallbackNotice(forced));
        }
        this.renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) =>
            this.onShaderError(gl, program, vertexShader, fragmentShader);

        // bloom and composer targets follow the drawing-buffer size (FR-051); the composer target is replaced when
        // the MSAA sample count changes (applyQuality)
        const bufferSize = this.renderer.getDrawingBufferSize(new THREE.Vector2());
        this.bloomPass = new UnrealBloomPass(bufferSize, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD, {
            mips: this.quality.bloomMips,
            type: this.targetType,
        });
        this.composer = new EffectComposer(this.renderer, this.createComposerTarget(0));
        this.appliedSamples = 0;
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());
        this.applyQuality();

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
        this.applyAmbient();
    }

    /**
     * Ambient of this view (FR-060, research R13): the hemisphere light follows the preset of `options.kind`, and
     * LED-lit surfaces get a matching tint (sky × intensity × 0.1). "dark" = intensity 0, only fixtures light the
     * scene. Tone-mapping exposure is not touched.
     */
    private applyAmbient() {
        const { sky, ground, intensity } = ambientLight(this.environment.ambientFor(this.options.kind));
        this.hemisphereLight.color.copy(sky);
        this.hemisphereLight.groundColor.copy(ground);
        // intensity 0 instead of hiding the light: a changed light count would recompile every lit material
        this.hemisphereLight.intensity = intensity;
        this.lighting.setAmbient(sky.clone().multiplyScalar(intensity * 0.1));
    }

    /**
     * Applies a quality level (T070, research R12): pixel ratio, composer MSAA, bloom mips, lighting loop sizes and
     * shadows. Renderers get the profile through `FrameContext.quality`. Positions, colors and beams do not depend
     * on the level (US6.1).
     */
    public setQuality(level: QualityLevel) {
        this.baseQuality = QUALITY_PROFILES[level] ?? QUALITY_PROFILES.medium;
        this.applyQuality();
    }

    /** The effective profile (selected level with device fallbacks). */
    public get qualityProfile(): QualityProfile {
        return this.quality;
    }

    private applyQuality() {
        if (this.disposed) {
            return;
        }
        const quality = applyFallbacks(this.baseQuality, this.fallbacks);
        this.quality = quality;
        this.applyPixelRatio();
        if (quality.msaaSamples !== this.appliedSamples) {
            this.appliedSamples = quality.msaaSamples;
            // reset() disposes the old targets; setPixelRatio sizes the new ones and all passes
            this.composer.reset(this.createComposerTarget(quality.msaaSamples));
            this.composer.setPixelRatio(this.appliedPixelRatio);
        }
        this.bloomPass.setMips(quality.bloomMips);
        // MAX_LIGHTS / MAX_SEGMENTS and the shadow atlas follow `quality` in lighting.update every frame
        this.lighting.setFallbacks({ shadows: this.fallbacks.has("shadows"), gobos: this.fallbacks.has("gobos") });
    }

    /** `min(devicePixelRatio, pixelRatioCap) × pixelRatioScale`; resizes the composer targets and passes. */
    private applyPixelRatio() {
        const dpr = this.canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
        const pixelRatio = Math.min(dpr, this.quality.pixelRatioCap) * this.quality.pixelRatioScale;
        if (pixelRatio === this.appliedPixelRatio) {
            return;
        }
        this.appliedPixelRatio = pixelRatio;
        this.renderer.setPixelRatio(pixelRatio);
        this.composer.setPixelRatio(pixelRatio);
    }

    private createComposerTarget(samples: number): THREE.WebGLRenderTarget {
        const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
        return new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: this.targetType, samples });
    }

    /**
     * `renderer.debug.onShaderError` (T072): logs the failure; a failed lighting or beam program schedules one
     * fallback step for the next frame.
     */
    private onShaderError(gl: WebGLRenderingContext, program: WebGLProgram, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
        const source = gl.getShaderSource(fragmentShader) ?? "";
        const relevant = FALLBACK_PROGRAM_MARKERS.some((marker) => source.includes(marker));
        console.error(
            "SceneView: shader program failed to compile/link" + (relevant ? "; using a simpler version" : ""),
            gl.getProgramInfoLog(program),
            gl.getShaderInfoLog(vertexShader),
            gl.getShaderInfoLog(fragmentShader),
        );
        if (relevant) {
            this.fallbackPending = true;
        }
    }

    /**
     * Downgrades the next feature (shadows → gobos → light count → MSAA), rebuilds and reports one notice per
     * feature. Returns false when nothing is left to downgrade.
     */
    private stepFallback(): boolean {
        const next = FALLBACK_ORDER.find((feature) => !this.fallbacks.has(feature));
        if (!next) {
            return false;
        }
        this.fallbacks.add(next);
        this.applyQuality();
        this.reportNotice(fallbackNotice(next));
        return true;
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
        // notices reported before the subscription are replayed
        for (const notice of this.reportedNotices.values()) {
            cb(notice);
        }
        return () => this.noticeCallbacks.delete(cb);
    }

    /** Reports a fallback notice to the subscribers, once per feature and view. */
    private reportNotice(notice: FallbackNotice) {
        if (this.reportedNotices.has(notice.feature)) {
            return;
        }
        this.reportedNotices.set(notice.feature, notice);
        for (const cb of this.noticeCallbacks) {
            cb(notice);
        }
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
        this.invalidateRaycastTargets();
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
        this.invalidateRaycastTargets();
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

    /**
     * Static meshes (shapes, library assets, imported models) of visible objects for beam-length and laser raycasts
     * (research R11).
     */
    public getRaycastTargets(): readonly THREE.Object3D[] {
        if (!this.raycastCache) {
            const targets: THREE.Object3D[] = [];
            for (const entry of this.entries.values()) {
                const obj = entry.data;
                // o3d.visible holds the effective visibility (refreshVisibility); raycasts ignore `visible`
                if (entry.o3d.visible && (isShape(obj) || isLibraryAsset(obj) || isImportedModel(obj))) {
                    collectMeshes(entry.o3d, targets, true);
                }
            }
            this.raycastCache = targets;
        }
        return this.raycastCache;
    }

    /**
     * Changes whenever the raycast targets may have changed (objects added, removed, moved, shown/hidden, model
     * content replaced). Renderers cache their raycasts against it; the shadow atlas re-renders its tiles.
     */
    public getRaycastTargetsVersion(): number {
        return this.raycastVersion;
    }

    /**
     * Surface under the given normalized device coordinates (feature 003, T050): the first hit of the raycast
     * targets with its world normal and scene object id. Misses fall back to the floor plane y = 0 (normal +Y,
     * object id null); returns null only if the ray does not reach the floor either.
     */
    public raycastSurfaces(ndc: { x: number; y: number }): SurfaceHit | null {
        surfaceRaycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
        this.root.updateMatrixWorld();
        const hit = surfaceRaycaster.intersectObjects(this.getRaycastTargets() as THREE.Object3D[], false)[0];
        if (hit) {
            const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
            // back faces of double-sided materials: the clicked side faces the camera
            if (normal.dot(surfaceRaycaster.ray.direction) > 0) {
                normal.negate();
            }
            let id: string | null = null;
            for (let o: THREE.Object3D | null = hit.object; o && !id; o = o.parent) {
                id = (o.userData[SCENE_OBJECT_ID] as string | undefined) ?? null;
            }
            return { point: hit.point.clone(), normal, objectId: id };
        }
        const point = surfaceRaycaster.ray.intersectPlane(FLOOR_PLANE, new THREE.Vector3());
        return point ? { point, normal: new THREE.Vector3(0, 1, 0), objectId: null } : null;
    }

    private invalidateRaycastTargets() {
        this.raycastCache = null;
        this.raycastVersion++;
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
        // the device pixel ratio changes when the window moves to another screen
        this.applyPixelRatio();
        this.renderer.setSize(width, height, false);
        // composer targets and passes (bloom) get width/height × pixel ratio (FR-051)
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
        this.renderer.debug.onShaderError = null;
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
        this.invalidateRaycastTargets();
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
        // a removed renderer no longer contributes to the hazer coupling (T067)
        this.environment.reportHazeOutput(entry.data.id, 0);
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
                    raycastTargetsVersion: this.raycastTargetsVersion,
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
        this.invalidateRaycastTargets();
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
        // the view never throws out of the render loop (FR-055): log once, then try the next fallback step
        try {
            this.renderFrame();
        } catch (err) {
            if (!this.renderErrorLogged) {
                this.renderErrorLogged = true;
                console.error("SceneView: render failed; trying a simpler version", err);
            }
            this.fallbackPending = true;
        }
    };

    private renderFrame() {
        if (this.fallbackPending) {
            // one step per frame: all failures of the previous frame came from the same settings
            this.fallbackPending = false;
            this.stepFallback();
        }
        const now = performance.now();
        const dt = Math.min(MAX_FRAME_DT, Math.max(0, (now - this.lastFrameTime) / 1000));
        this.lastFrameTime = now;
        this.updateFrameStats(now);

        this.applyDirty();
        for (const cb of this.beforeRenderCallbacks) {
            cb();
        }
        this.scene.updateMatrixWorld();
        this.environment.update(dt);
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
        this.lighting.update(this.camera, this.scene, this.renderer, this.quality, this.raycastVersion);
        this.composer.render();
        if (import.meta.env.DEV) {
            const stats = devVizStats();
            if (stats) stats.framesRendered++;
        }
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
