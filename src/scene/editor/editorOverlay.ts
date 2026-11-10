import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { ref, toRaw, watch, type Ref, type WatchStopHandle } from "vue";

import { EDITOR_LAYER, type SceneView } from "@/visualization/sceneView";
import { SCENE_OBJECT_ID } from "@/visualization/objectBuilders";
import { assetCatalog, completeParams } from "@/assetLibrary";
import {
    fromMatrix,
    getDescendantIds,
    getParentWorldMatrix,
    getSelectionRoots,
    getWorldMatrix,
    isEffectivelyVisible,
    toMatrix,
    worldToLocal,
    type LocalTransform,
} from "../model/transformMath";
import { isFixtureVisualization, isLibraryAsset, type CameraPose, type SceneObject, type Vec3 } from "../model/types";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import type { ObjectStates, useScene } from "../sceneStore";
import { computeObjectBounds } from "./bounds";
import { AssetDropController, type SurfacePlacement } from "./assetDrop";
import { isTrussAsset, SnapHighlightView, SnapResolver, type SnapResult } from "./snapping";

type SceneStore = ReturnType<typeof useScene>;
export type ViewPreset = "top" | "front" | "side" | "perspective";

const CLICK_THRESHOLD_PX = 4;
const CAMERA_ANIMATION_MS = 250;
const MIN_FOCUS_RADIUS = 0.25;
const ACTIVE_COLOR = 0xffcc00;
const SELECTED_COLOR = 0x4fc3f7;

interface SelectionVisual {
    box: THREE.Box3;
    helper: THREE.Box3Helper;
    axes?: THREE.AxesHelper;
}

interface CameraAnimation {
    start: number;
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromFov: number;
    toFov: number;
}

interface DragState {
    kind: "objects" | "endpoint";
    before: ObjectStates;
    label: string;
    /** multi-selection: pivot at drag start and the world matrices of the moved roots */
    pivotStart?: THREE.Matrix4;
    worldStart?: Map<string, THREE.Matrix4>;
    /** single-object translate drag of a fixture or truss element: mount/connection snapping (T083) */
    snap?: GizmoSnap;
}

interface GizmoSnap {
    kind: "fixture" | "truss";
    id: string;
    /** local transform at drag start; the gizmo only moves the position */
    start: LocalTransform;
    /** unsnapped local position from the gizmo (the preview may show the snapped one) */
    raw: THREE.Vector3 | null;
    result: SnapResult | null;
}

function toVec3(v: THREE.Vector3): Vec3 {
    return [v.x, v.y, v.z];
}

function labelTexture(text: string, color: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 32, 34);
    return new THREE.CanvasTexture(canvas);
}

/**
 * Editing aids on top of a `SceneView`: navigation, grid and axes, picking, selection highlight, labels, transform
 * handles (also for multi-selection), snapping and LED strip endpoint handles. Everything it adds lives on the
 * editor layer or outside `view.root`, so nothing of it reaches the show window.
 */
export class EditorOverlay {
    public readonly controls: OrbitControls;
    /** Called for a right click that was not a camera pan. */
    public onContextMenu: ((event: MouseEvent) => void) | null = null;
    /** Drag & drop placement of library assets (feature 002). */
    public readonly assetDrop: AssetDropController;
    /** Status hint of the active snap candidate ("Hang on Truss 1"), null if there is none (T084). */
    public readonly snapHint: Ref<string | null> = ref(null);

    private readonly transform: TransformControls;
    private readonly endpointTransform: TransformControls;
    private readonly labelRenderer = new CSS2DRenderer();
    private readonly grid = new THREE.Group();
    private readonly axesScene = new THREE.Scene();
    private readonly axesCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
    private readonly raycaster = new THREE.Raycaster();
    private readonly pivot = new THREE.Object3D();
    private readonly selectionVisuals = new Map<string, SelectionVisual>();
    private readonly labels = new Map<string, CSS2DObject>();
    private readonly endpointHandles: THREE.Mesh[] = [];
    private readonly disposables: Array<{ dispose(): void }> = [];
    private readonly stopHandles: WatchStopHandle[] = [];
    private readonly unsubscribers: Array<() => void> = [];
    private readonly snapResolver: SnapResolver;
    private readonly snapHighlight: SnapHighlightView;

    private animation: CameraAnimation | null = null;
    private drag: DragState | null = null;
    private pendingPreview = false;
    private cancelling = false;
    private ctrlHeld = false;
    private persistTimeout: ReturnType<typeof setTimeout> | undefined;
    private lastSurfaceHit: { point: Vec3; normal: Vec3 } | null = null;
    private lastHitTime = 0;
    private pointerDown: { x: number; y: number; button: number; ignore: boolean } | null = null;
    private attachedEndpoint: THREE.Mesh | null = null;
    private endpointObjectId: string | null = null;
    private multiPivotIds: string[] = [];
    private disposed = false;

    public constructor(private readonly view: SceneView, private readonly container: HTMLElement, private readonly store: SceneStore) {
        const canvas = view.canvas;
        this.raycaster.layers.enable(EDITOR_LAYER);

        // transform controls first: their pointer handlers have to run before the orbit controls' handlers
        this.transform = new TransformControls(view.camera, canvas);
        this.endpointTransform = new TransformControls(view.camera, canvas);
        this.endpointTransform.setMode("translate");
        this.endpointTransform.setSize(0.6);
        for (const t of [this.transform, this.endpointTransform]) {
            const helper = t.getHelper();
            helper.traverse((o) => (o.userData.editorHelper = true));
            view.scene.add(helper);
        }

        this.controls = new OrbitControls(view.camera, canvas);
        this.controls.zoomToCursor = true;
        this.controls.enableDamping = false;
        this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
        this.restoreEditorCamera();

        this.setupGrid();
        this.setupAxes();
        this.setupLabels();
        this.view.scene.add(this.pivot);

        this.transform.addEventListener("dragging-changed", (event) => this.onDraggingChanged(event.value as boolean, false));
        this.transform.addEventListener("objectChange", () => this.onTransformObjectChange());
        this.endpointTransform.addEventListener("dragging-changed", (event) => this.onDraggingChanged(event.value as boolean, true));
        this.endpointTransform.addEventListener("objectChange", () => this.previewEndpoint());

        canvas.addEventListener("pointerdown", this.onPointerDown);
        canvas.addEventListener("pointerup", this.onPointerUp);
        canvas.addEventListener("pointermove", this.onPointerMove);
        canvas.addEventListener("dblclick", this.onDoubleClick);
        canvas.addEventListener("contextmenu", this.onContextMenuEvent);
        window.addEventListener("keydown", this.onKey);
        window.addEventListener("keyup", this.onKey);

        this.controls.addEventListener("change", this.onCameraChanged);
        this.unsubscribers.push(view.onBeforeRender(this.beforeRender), view.onAfterRender(this.afterRender));

        // reactive inputs
        this.stopHandles.push(
            watch(() => [...store.selection], () => this.onSelectionChanged()),
            watch(
                () => [store.scene.settings.showGrid, store.scene.settings.showAxes],
                () => this.updateHelperVisibility(),
                { immediate: true }
            ),
            watch(
                () => [store.transformMode, store.scene.settings.transformSpace],
                () => this.refreshAttachment()
            ),
            watch(
                () => [
                    store.scene.settings.snapEnabled,
                    store.scene.settings.translationSnap,
                    store.scene.settings.rotationSnap,
                    store.scene.settings.scaleSnap,
                ],
                () => this.applySnapping(),
                { immediate: true }
            ),
            watch(
                () => store.scene.settings.showLabels,
                () => this.syncLabels()
            ),
            // objects changed from outside (inspector, undo): handles and highlights follow
            watch(
                () => store.scene.objects,
                () => this.onObjectsChanged(),
                { deep: true }
            )
        );
        this.onSelectionChanged();

        this.snapResolver = new SnapResolver(
            () => toRaw(store.scene),
            () => store.historyVersion
        );
        this.snapHighlight = new SnapHighlightView(view.scene);
        this.assetDrop = new AssetDropController(view, store, canvas, (ndc) => {
            this.raycaster.setFromCamera(ndc, this.view.camera);
            return { placement: this.raycastSurface(), ray: this.raycaster.ray.clone() };
        });
        this.assetDrop.resolveSnap = (assetId, point, ray, event) => this.resolveLibrarySnap(assetId, point, ray, event);
        this.assetDrop.onSnapChange = (snap) => this.showSnap(snap);
    }

    // -----------------------------------------------------------------------------------------------------------
    // public API

    public get isDragging(): boolean {
        return this.drag !== null;
    }

    public getLastSurfaceHit() {
        return this.lastSurfaceHit;
    }

    /** Surface point under the given normalized device coordinates, e.g. `{ x: 0, y: 0 }` for the viewport center. */
    public surfaceHitAt(ndc: { x: number; y: number }): SurfacePlacement | null {
        this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.view.camera);
        return this.raycastSurface();
    }

    public getCameraPose(): CameraPose {
        return { position: toVec3(this.view.camera.position), target: toVec3(this.controls.target), fov: this.view.camera.fov };
    }

    public resize(width: number, height: number) {
        this.view.resize(width, height);
        this.labelRenderer.setSize(width, height);
    }

    public setCameraPose(pose: CameraPose, animate = true) {
        const toPosition = new THREE.Vector3(...pose.position);
        const toTarget = new THREE.Vector3(...pose.target);
        if (!animate) {
            this.animation = null;
            this.applyCamera(toPosition, toTarget, pose.fov);
            return;
        }
        this.animation = {
            start: performance.now(),
            fromPosition: this.view.camera.position.clone(),
            toPosition,
            fromTarget: this.controls.target.clone(),
            toTarget,
            fromFov: this.view.camera.fov,
            toFov: pose.fov,
        };
    }

    /** Moves the camera to an axis-aligned position around the current orbit target at the current distance. */
    public setView(preset: ViewPreset) {
        const target = this.controls.target.clone();
        const distance = Math.max(this.view.camera.position.distanceTo(target), 0.5);
        const direction = new THREE.Vector3();
        switch (preset) {
            case "front":
                direction.set(0, 0, 1);
                break;
            case "side":
                direction.set(1, 0, 0);
                break;
            case "top":
                // tiny Z offset avoids a gimbal flip
                direction.set(0, 1, 0.0001).normalize();
                break;
            case "perspective": {
                const azimuth = THREE.MathUtils.degToRad(45);
                const elevation = THREE.MathUtils.degToRad(30);
                direction.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
                break;
            }
        }
        this.setCameraPose({ position: toVec3(target.clone().addScaledVector(direction, distance)), target: toVec3(target), fov: this.view.camera.fov });
    }

    /** Fits the bounding sphere of the selection into the view (min radius 0.25 m, also for hidden objects). */
    public focusSelection() {
        const box = new THREE.Box3();
        const objectBox = new THREE.Box3();
        for (const id of this.store.selection) {
            const o3d = this.view.getObject3D(id);
            if (!o3d) {
                continue;
            }
            computeObjectBounds(o3d, objectBox);
            if (objectBox.isEmpty()) {
                const p = new THREE.Vector3();
                o3d.updateWorldMatrix(true, false);
                o3d.getWorldPosition(p);
                objectBox.set(p.clone(), p.clone());
            }
            box.union(objectBox);
        }
        if (box.isEmpty()) {
            return;
        }
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        const radius = Math.max(sphere.radius, MIN_FOCUS_RADIUS);
        const fov = THREE.MathUtils.degToRad(this.view.camera.fov);
        const distance = (radius / Math.sin(Math.min(fov, THREE.MathUtils.degToRad(120)) / 2)) * 1.2;
        const direction = this.view.camera.position.clone().sub(this.controls.target);
        if (direction.lengthSq() < 1e-8) {
            direction.set(0, 0.5, 1);
        }
        direction.normalize();
        this.setCameraPose({
            position: toVec3(sphere.center.clone().addScaledVector(direction, distance)),
            target: toVec3(sphere.center),
            fov: this.view.camera.fov,
        });
    }

    /**
     * Cancels a running handle drag without a history entry (Escape or undo). Returns true if a drag was running.
     */
    public cancelDrag(): boolean {
        if (!this.drag) {
            return false;
        }
        const drag = this.drag;
        this.cancelling = true;
        try {
            this.store.cancelPreview(drag.before);
            const active = drag.kind === "endpoint" ? this.endpointTransform : this.transform;
            active.reset();
            active.pointerUp(null);
        } finally {
            this.cancelling = false;
            this.drag = null;
            this.controls.enabled = true;
            this.showSnap(null);
        }
        this.refreshAttachment();
        return true;
    }

    public dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        clearTimeout(this.persistTimeout);
        this.assetDrop.dispose();
        this.snapHighlight.dispose();
        const canvas = this.view.canvas;
        canvas.removeEventListener("pointerdown", this.onPointerDown);
        canvas.removeEventListener("pointerup", this.onPointerUp);
        canvas.removeEventListener("pointermove", this.onPointerMove);
        canvas.removeEventListener("dblclick", this.onDoubleClick);
        canvas.removeEventListener("contextmenu", this.onContextMenuEvent);
        window.removeEventListener("keydown", this.onKey);
        window.removeEventListener("keyup", this.onKey);
        this.controls.removeEventListener("change", this.onCameraChanged);
        this.stopHandles.forEach((stop) => stop());
        this.unsubscribers.forEach((unsubscribe) => unsubscribe());
        this.clearSelectionVisuals();
        this.clearEndpointHandles();
        for (const label of this.labels.values()) {
            label.removeFromParent();
            label.element.remove();
        }
        this.labels.clear();
        this.transform.detach();
        this.endpointTransform.detach();
        for (const t of [this.transform, this.endpointTransform]) {
            t.getHelper().removeFromParent();
            t.dispose();
        }
        this.controls.dispose();
        this.grid.removeFromParent();
        this.pivot.removeFromParent();
        this.labelRenderer.domElement.remove();
        this.disposables.forEach((d) => d.dispose());
        this.disposables.length = 0;
    }

    // -----------------------------------------------------------------------------------------------------------
    // camera

    private restoreEditorCamera() {
        const pose = this.store.scene.editorCamera;
        this.applyCamera(new THREE.Vector3(...pose.position), new THREE.Vector3(...pose.target), pose.fov);
    }

    private applyCamera(position: THREE.Vector3, target: THREE.Vector3, fov: number) {
        this.view.camera.position.copy(position);
        this.view.camera.fov = fov;
        this.view.camera.updateProjectionMatrix();
        this.controls.target.copy(target);
        this.controls.update();
    }

    private readonly onCameraChanged = () => {
        // the editor camera is persisted with the project, debounced
        clearTimeout(this.persistTimeout);
        this.persistTimeout = setTimeout(() => {
            if (!this.disposed) {
                this.store.setEditorCamera(this.getCameraPose());
            }
        }, 500);
    };

    private updateAnimation() {
        if (!this.animation) {
            return;
        }
        const a = this.animation;
        const t = Math.min((performance.now() - a.start) / CAMERA_ANIMATION_MS, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const position = a.fromPosition.clone().lerp(a.toPosition, eased);
        const target = a.fromTarget.clone().lerp(a.toTarget, eased);
        this.applyCamera(position, target, a.fromFov + (a.toFov - a.fromFov) * eased);
        if (t >= 1) {
            this.animation = null;
        }
    }

    // -----------------------------------------------------------------------------------------------------------
    // grid, axes, labels

    private setupGrid() {
        const major = new THREE.GridHelper(20, 20, 0x888888, 0x555555);
        const minor = new THREE.GridHelper(20, 80, 0x444444, 0x444444);
        for (const g of [major, minor]) {
            const material = g.material as THREE.LineBasicMaterial;
            material.transparent = true;
            material.opacity = g === minor ? 0.25 : 0.6;
            material.depthWrite = false;
            g.position.y = 0.001;
            this.disposables.push(g.geometry, material);
        }
        this.grid.add(minor, major);
        this.grid.traverse((o) => {
            o.layers.set(EDITOR_LAYER);
            o.userData.editorHelper = true;
        });
        this.view.scene.add(this.grid);
    }

    private setupAxes() {
        const axes = new THREE.AxesHelper(1);
        (axes.material as THREE.Material).toneMapped = false;
        this.axesScene.add(axes);
        this.disposables.push(axes.geometry, axes.material as THREE.Material);
        const tips: Array<[string, string, THREE.Vector3]> = [
            ["X", "#ff4040", new THREE.Vector3(1.25, 0, 0)],
            ["Y", "#40ff40", new THREE.Vector3(0, 1.25, 0)],
            ["Z", "#4080ff", new THREE.Vector3(0, 0, 1.25)],
        ];
        for (const [text, color, position] of tips) {
            const texture = labelTexture(text, color);
            const material = new THREE.SpriteMaterial({ map: texture, toneMapped: false, depthTest: false });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(position);
            sprite.scale.setScalar(0.45);
            this.axesScene.add(sprite);
            this.disposables.push(texture, material);
        }
    }

    private setupLabels() {
        const element = this.labelRenderer.domElement;
        element.style.position = "absolute";
        element.style.top = "0";
        element.style.left = "0";
        element.style.pointerEvents = "none";
        element.style.overflow = "hidden";
        this.container.appendChild(element);
        const width = this.view.canvas.clientWidth;
        const height = this.view.canvas.clientHeight;
        this.labelRenderer.setSize(width, height);
    }

    private updateHelperVisibility() {
        const settings = this.store.scene.settings;
        this.grid.visible = settings.showGrid;
        this.axesScene.visible = settings.showAxes;
    }

    private renderAxesGizmo() {
        if (!this.store.scene.settings.showAxes) {
            return;
        }
        const renderer = this.view.renderer;
        const size = 110;
        const margin = 8;
        const previousAutoClear = renderer.autoClear;
        const previousViewport = renderer.getViewport(new THREE.Vector4());
        const previousScissor = renderer.getScissor(new THREE.Vector4());
        const previousScissorTest = renderer.getScissorTest();

        // the gizmo camera looks at the origin from the main camera's direction
        const direction = this.view.camera.position.clone().sub(this.controls.target).normalize();
        this.axesCamera.position.copy(direction.multiplyScalar(3.5));
        this.axesCamera.up.copy(this.view.camera.up);
        this.axesCamera.lookAt(0, 0, 0);

        renderer.autoClear = false;
        renderer.setScissorTest(true);
        renderer.setViewport(margin, margin, size, size);
        renderer.setScissor(margin, margin, size, size);
        renderer.clearDepth();
        renderer.render(this.axesScene, this.axesCamera);

        renderer.setViewport(previousViewport);
        renderer.setScissor(previousScissor);
        renderer.setScissorTest(previousScissorTest);
        renderer.autoClear = previousAutoClear;
    }

    private syncLabels() {
        const showAll = this.store.scene.settings.showLabels;
        const wanted = new Set<string>();
        for (const obj of Object.values(this.store.scene.objects)) {
            if (showAll || this.store.selection.includes(obj.id)) {
                wanted.add(obj.id);
            }
        }
        for (const [id, label] of this.labels) {
            if (!wanted.has(id)) {
                label.removeFromParent();
                label.element.remove();
                this.labels.delete(id);
            }
        }
        for (const id of wanted) {
            const obj = this.store.scene.objects[id];
            let label = this.labels.get(id);
            if (!label) {
                const element = document.createElement("div");
                element.className = "scene-editor-label";
                element.style.cssText =
                    "color:#fff;background:rgba(0,0,0,0.6);padding:1px 6px;border-radius:3px;font-size:11px;white-space:nowrap;transform:translateY(-8px)";
                label = new CSS2DObject(element);
                label.layers.set(EDITOR_LAYER);
                label.userData.editorHelper = true;
                this.view.scene.add(label);
                this.labels.set(id, label);
            }
            label.element.textContent = obj.name;
        }
    }

    private updateLabelPositions() {
        const box = new THREE.Box3();
        for (const [id, label] of this.labels) {
            const o3d = this.view.getObject3D(id);
            if (!o3d) {
                label.visible = false;
                continue;
            }
            label.visible = o3d.visible;
            computeObjectBounds(o3d, box);
            if (box.isEmpty()) {
                o3d.getWorldPosition(label.position);
            } else {
                box.getCenter(label.position);
                label.position.y = box.max.y;
            }
        }
    }

    // -----------------------------------------------------------------------------------------------------------
    // selection visuals

    private clearSelectionVisuals() {
        for (const visual of this.selectionVisuals.values()) {
            visual.helper.removeFromParent();
            visual.helper.dispose();
            visual.axes?.removeFromParent();
            visual.axes?.dispose();
        }
        this.selectionVisuals.clear();
    }

    private syncSelectionVisuals() {
        const selected = new Set(this.store.selection);
        for (const [id, visual] of [...this.selectionVisuals]) {
            if (!selected.has(id) || !this.view.getObject3D(id)) {
                visual.helper.removeFromParent();
                visual.helper.dispose();
                visual.axes?.removeFromParent();
                visual.axes?.dispose();
                this.selectionVisuals.delete(id);
            }
        }
        for (const id of selected) {
            const o3d = this.view.getObject3D(id);
            const obj = this.store.scene.objects[id];
            if (!o3d || !obj || this.selectionVisuals.has(id)) {
                continue;
            }
            const box = new THREE.Box3();
            const helper = new THREE.Box3Helper(box, SELECTED_COLOR);
            helper.layers.set(EDITOR_LAYER);
            helper.userData.editorHelper = true;
            (helper.material as THREE.Material).depthTest = false;
            this.view.scene.add(helper);
            const visual: SelectionVisual = { box, helper };
            if (obj.kind === "group") {
                // groups have no geometry: show a small axes cross instead
                const axes = new THREE.AxesHelper(0.3);
                axes.layers.set(EDITOR_LAYER);
                axes.userData.editorHelper = true;
                o3d.add(axes);
                visual.axes = axes;
            }
            this.selectionVisuals.set(id, visual);
        }
    }

    private updateSelectionVisuals() {
        const active = this.store.activeId;
        for (const [id, visual] of this.selectionVisuals) {
            const o3d = this.view.getObject3D(id);
            if (!o3d) {
                continue;
            }
            computeObjectBounds(o3d, visual.box);
            visual.helper.visible = !visual.box.isEmpty();
            (visual.helper.material as THREE.LineBasicMaterial).color.setHex(id === active ? ACTIVE_COLOR : SELECTED_COLOR);
        }
    }

    // -----------------------------------------------------------------------------------------------------------
    // picking

    private ndcFromEvent(event: MouseEvent): THREE.Vector2 {
        const rect = this.view.canvas.getBoundingClientRect();
        return new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    }

    private resolveSceneObjectId(object: THREE.Object3D): string | null {
        let current: THREE.Object3D | null = object;
        while (current) {
            const id = current.userData[SCENE_OBJECT_ID] as string | undefined;
            if (id) {
                return id;
            }
            current = current.parent;
        }
        return null;
    }

    private isPickable(id: string): boolean {
        const obj = this.store.scene.objects[id];
        return !!obj && !obj.locked && isEffectivelyVisible(this.store.scene, id);
    }

    /** First pickable scene object under the pointer. */
    private pickObjectId(event: MouseEvent): string | null {
        this.raycaster.setFromCamera(this.ndcFromEvent(event), this.view.camera);
        for (const hit of this.raycaster.intersectObject(this.view.root, true)) {
            const id = this.resolveSceneObjectId(hit.object);
            if (id && this.isPickable(id)) {
                return id;
            }
        }
        return null;
    }

    private pickEndpointHandle(event: MouseEvent): THREE.Mesh | null {
        if (this.endpointHandles.length === 0) {
            return null;
        }
        this.raycaster.setFromCamera(this.ndcFromEvent(event), this.view.camera);
        const hits = this.raycaster.intersectObjects(this.endpointHandles, false);
        return (hits[0]?.object as THREE.Mesh | undefined) ?? null;
    }

    private updateSurfaceHit(event: MouseEvent) {
        const now = performance.now();
        if (now - this.lastHitTime < 50) {
            return;
        }
        this.lastHitTime = now;
        this.raycaster.setFromCamera(this.ndcFromEvent(event), this.view.camera);
        this.lastSurfaceHit = this.raycastSurface();
    }

    /** First visible scene object surface hit by the raycaster's current ray. */
    private raycastSurface(): SurfacePlacement | null {
        for (const hit of this.raycaster.intersectObject(this.view.root, true)) {
            const id = this.resolveSceneObjectId(hit.object);
            if (!id || !isEffectivelyVisible(this.store.scene, id) || !hit.face) {
                continue;
            }
            const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
            return { point: toVec3(hit.point), normal: toVec3(normal) };
        }
        return null;
    }

    private lastRightDown: { x: number; y: number } | null = null;

    private readonly onPointerDown = (event: PointerEvent) => {
        if (event.button === 2) {
            this.lastRightDown = { x: event.clientX, y: event.clientY };
        }
        this.pointerDown = {
            x: event.clientX,
            y: event.clientY,
            button: event.button,
            // a press on a handle is not a click on the scene
            ignore: this.transform.dragging || this.endpointTransform.dragging,
        };
        this.animation = null;
    };

    private readonly onPointerMove = (event: PointerEvent) => {
        if (event.buttons === 0) {
            this.updateSurfaceHit(event);
        }
    };

    private readonly onPointerUp = (event: PointerEvent) => {
        const down = this.pointerDown;
        this.pointerDown = null;
        if (!down || down.button !== event.button || down.ignore || this.drag) {
            return;
        }
        const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
        if (moved >= CLICK_THRESHOLD_PX || event.button !== 0) {
            return;
        }

        const handle = this.pickEndpointHandle(event);
        if (handle) {
            this.attachEndpoint(handle);
            return;
        }
        if (this.attachedEndpoint) {
            this.detachEndpoint();
        }

        const id = this.pickObjectId(event);
        if (id) {
            this.store.select([id], event.ctrlKey || event.shiftKey || event.metaKey ? "toggle" : "replace");
        } else {
            this.store.clearSelection();
        }
    };

    private readonly onDoubleClick = (event: MouseEvent) => {
        if (this.pickObjectId(event)) {
            this.focusSelection();
        }
    };

    private readonly onContextMenuEvent = (event: MouseEvent) => {
        event.preventDefault();
        const down = this.lastRightDown;
        // a right drag pans the camera, only a plain click opens the menu
        if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= CLICK_THRESHOLD_PX) {
            return;
        }
        const id = this.pickObjectId(event);
        if (id && !this.store.selection.includes(id)) {
            this.store.select([id], "replace");
        }
        this.onContextMenu?.(event);
    };

    // -----------------------------------------------------------------------------------------------------------
    // transform handles

    private applySnapping() {
        const settings = this.store.scene.settings;
        // holding Ctrl inverts the snapping state (FR-023)
        const snap = settings.snapEnabled !== this.ctrlHeld;
        this.transform.setTranslationSnap(snap ? settings.translationSnap : null);
        this.transform.setRotationSnap(snap ? THREE.MathUtils.degToRad(settings.rotationSnap) : null);
        this.transform.setScaleSnap(snap ? settings.scaleSnap : null);
        this.endpointTransform.setTranslationSnap(snap ? settings.translationSnap : null);
    }

    private readonly onKey = (event: KeyboardEvent) => {
        if (event.key === "Control" || event.key === "Meta") {
            const held = event.type === "keydown";
            if (held !== this.ctrlHeld) {
                this.ctrlHeld = held;
                this.applySnapping();
                // Ctrl toggles mount/connection snapping of a running gizmo drag immediately (T083)
                if (this.drag?.snap && !this.cancelling) {
                    this.applyPreview(this.drag);
                }
            }
        }
    };

    private onSelectionChanged() {
        if (this.attachedEndpoint && !(this.store.selection.length === 1 && this.store.selection[0] === this.endpointObjectId)) {
            this.detachEndpoint();
        }
        this.syncSelectionVisuals();
        this.syncLabels();
        this.syncEndpointHandles();
        this.refreshAttachment();
    }

    private onObjectsChanged() {
        if (this.drag) {
            return;
        }
        this.syncSelectionVisuals();
        this.syncLabels();
        this.syncEndpointHandles();
        this.refreshAttachment();
    }

    /** Candidates for handles: selected, unlocked and effectively visible objects with a built Object3D. */
    private transformableIds(): string[] {
        return this.store.selection.filter((id) => this.isPickable(id) && this.view.getObject3D(id));
    }

    /** Re-attaches the handles after selection, mode, space, lock/visibility changes or undo/redo. */
    private refreshAttachment() {
        if (this.disposed || this.drag) {
            return;
        }
        this.transform.setMode(this.store.transformMode);
        this.transform.setSpace(this.store.scene.settings.transformSpace);
        if (this.attachedEndpoint) {
            this.transform.detach();
            return;
        }

        const ids = this.transformableIds();
        if (ids.length === 0) {
            this.transform.detach();
            this.multiPivotIds = [];
        } else if (ids.length === 1) {
            this.multiPivotIds = [];
            const o3d = this.view.getObject3D(ids[0])!;
            if (this.transform.object !== o3d) {
                this.transform.attach(o3d);
            }
        } else {
            this.multiPivotIds = ids;
            this.placePivot(ids);
            this.transform.attach(this.pivot);
        }
    }

    /** Pivot at the center of the selection's bounds, oriented like the active object in local space. */
    private placePivot(ids: string[]) {
        const box = new THREE.Box3();
        const objectBox = new THREE.Box3();
        const position = new THREE.Vector3();
        const positions = new THREE.Vector3();
        for (const id of ids) {
            const o3d = this.view.getObject3D(id)!;
            computeObjectBounds(o3d, objectBox);
            o3d.getWorldPosition(position);
            positions.add(position);
            box.union(objectBox);
        }
        if (box.isEmpty()) {
            box.set(positions.divideScalar(ids.length), positions.clone());
        }
        box.getCenter(this.pivot.position);
        this.pivot.scale.set(1, 1, 1);
        this.pivot.quaternion.identity();
        if (this.store.scene.settings.transformSpace === "local" && this.store.activeId) {
            const active = this.view.getObject3D(this.store.activeId);
            active?.getWorldQuaternion(this.pivot.quaternion);
        }
        this.pivot.updateMatrixWorld(true);
    }

    private onDraggingChanged(dragging: boolean, endpoint: boolean) {
        this.controls.enabled = !dragging;
        if (this.cancelling) {
            return;
        }
        if (dragging) {
            this.startDrag(endpoint);
        } else {
            this.endDrag();
        }
    }

    private startDrag(endpoint: boolean) {
        const mode = this.store.transformMode;
        const label = endpoint ? "Move strip endpoint" : mode === "translate" ? "Move" : mode === "rotate" ? "Rotate" : "Scale";
        if (endpoint) {
            this.drag = { kind: "endpoint", before: this.store.captureBeforeStates(this.endpointObjectId ? [this.endpointObjectId] : []), label };
            return;
        }
        if (this.multiPivotIds.length > 0 && this.transform.object === this.pivot) {
            const roots = getSelectionRoots(this.store.scene, this.multiPivotIds);
            const worldStart = new Map<string, THREE.Matrix4>();
            for (const id of roots) {
                worldStart.set(id, getWorldMatrix(this.store.scene, id));
            }
            this.drag = {
                kind: "objects",
                before: this.store.captureBeforeStates(roots),
                label,
                pivotStart: this.pivot.matrixWorld.clone(),
                worldStart,
            };
        } else {
            const id = this.store.activeId;
            this.drag = { kind: "objects", before: this.store.captureBeforeStates(id ? [id] : []), label };
            const snapKind = id && mode === "translate" ? this.snapKindOf(id) : null;
            if (id && snapKind) {
                const obj = this.store.scene.objects[id];
                this.drag.snap = {
                    kind: snapKind,
                    id,
                    start: { position: [...obj.position], rotation: [...obj.rotation], scale: [...obj.scale] },
                    raw: null,
                    result: null,
                };
            }
        }
    }

    /** Objects snapped while moved with the gizmo: fixture visualizations with a model and truss elements. */
    private snapKindOf(id: string): "fixture" | "truss" | null {
        const obj = this.store.scene.objects[id];
        if (!obj) {
            return null;
        }
        if (isFixtureVisualization(obj)) {
            return assetCatalog.get(obj.modelId ?? "")?.category === "fixtures" ? "fixture" : null;
        }
        return isLibraryAsset(obj) && isTrussAsset(obj.assetId) ? "truss" : null;
    }

    private endDrag() {
        const drag = this.drag;
        this.drag = null;
        this.pendingPreview = false;
        if (!drag) {
            return;
        }
        if (drag.kind === "objects") {
            // flush the final state before committing
            this.applyPreview(drag);
        }
        const snap = drag.snap;
        this.showSnap(null);
        if (snap?.kind === "fixture" && snap.result && snap.result.kind !== "connect") {
            // mounted: transform and reparent form one history entry
            this.store.commitPreview(drag.before, drag.label, { reparent: { ids: [snap.id], parentId: snap.result.targetId } });
        } else {
            this.store.commitPreview(drag.before, drag.label);
        }
        // the pivot of a multi-selection moves with the objects
        this.refreshAttachment();
    }

    private onTransformObjectChange() {
        const snap = this.drag?.snap;
        if (snap && !this.cancelling) {
            // remember the gizmo's own position before the preview replaces it with the snapped one
            const o3d = this.view.getObject3D(snap.id);
            if (o3d) {
                snap.raw = o3d.position.clone();
            }
        }
        this.schedulePreview();
    }

    private schedulePreview() {
        if (this.cancelling || !this.drag || this.pendingPreview) {
            return;
        }
        this.pendingPreview = true;
        requestAnimationFrame(() => {
            this.pendingPreview = false;
            if (this.drag && !this.cancelling) {
                this.applyPreview(this.drag);
            }
        });
    }

    private applyPreview(drag: DragState) {
        if (drag.kind !== "objects") {
            return;
        }
        if (drag.pivotStart && drag.worldStart) {
            this.pivot.updateMatrixWorld(true);
            const delta = this.pivot.matrixWorld.clone().multiply(drag.pivotStart.clone().invert());
            const transforms: Record<string, ReturnType<typeof fromMatrix>> = {};
            for (const [id, start] of drag.worldStart) {
                const parentId = this.store.scene.objects[id]?.parentId ?? null;
                transforms[id] = worldToLocal(this.store.scene, parentId, delta.clone().multiply(start));
            }
            this.store.previewTransforms(transforms);
            return;
        }
        if (drag.snap) {
            this.applySnapPreview(drag.snap);
            return;
        }
        const id = this.store.activeId;
        const o3d = id ? this.view.getObject3D(id) : undefined;
        if (!id || !o3d) {
            return;
        }
        o3d.updateMatrix();
        const transform = fromMatrix(o3d.matrix);
        // negative or tiny scale is not possible: keep the handle in sync with the clamped value
        o3d.scale.set(...transform.scale);
        this.store.previewTransforms({ [id]: transform });
    }

    // -----------------------------------------------------------------------------------------------------------
    // mount and connection snapping (feature 002, US5)

    private showSnap(snap: SnapResult | null) {
        this.snapHighlight.show(snap?.highlight ?? null);
        this.snapHint.value = snap?.label ?? null;
    }

    /** Library drag: fixtures mount, truss elements connect; Ctrl disables both (FR-043). */
    private resolveLibrarySnap(assetId: string, point: THREE.Vector3, ray: THREE.Ray, event: DragEvent): SnapResult | null {
        if (event.ctrlKey || event.metaKey) {
            return null;
        }
        const definition = assetCatalog.get(assetId);
        if (!definition) {
            return null;
        }
        if (definition.category === "fixtures") {
            // the ghost stands upright at the pointer with the model's base point there
            return this.snapResolver.resolveFixture(definition, 1, point, { ray });
        }
        if (isTrussAsset(definition.id)) {
            const world = new THREE.Matrix4().makeTranslation(point.x, point.y, point.z);
            return this.snapResolver.resolveTruss(definition, completeParams(definition, {}), world, { ray });
        }
        return null;
    }

    /** Gizmo translate drag of one fixture or truss element: preview the snapped transform if there is a candidate. */
    private applySnapPreview(snap: GizmoSnap) {
        const scene = this.store.scene;
        const obj = scene.objects[snap.id];
        const o3d = this.view.getObject3D(snap.id);
        if (!obj || !o3d) {
            return;
        }
        const raw = snap.raw ?? o3d.position.clone();
        const unsnapped: LocalTransform = { position: [raw.x, raw.y, raw.z], rotation: snap.start.rotation, scale: snap.start.scale };
        snap.result = this.ctrlHeld ? null : this.resolveGizmoSnap(snap, obj, unsnapped);
        this.showSnap(snap.result);

        let transform = unsnapped;
        if (snap.result) {
            const world = getParentWorldMatrix(scene, obj.parentId).multiply(toMatrix(unsnapped));
            const worldScale = new THREE.Vector3();
            world.decompose(new THREE.Vector3(), new THREE.Quaternion(), worldScale);
            const snapped = toMatrix({ position: snap.result.position, rotation: snap.result.rotation, scale: [worldScale.x, worldScale.y, worldScale.z] });
            transform = { ...worldToLocal(scene, obj.parentId, snapped), scale: snap.start.scale };
        }
        this.store.previewTransforms({ [snap.id]: transform });
    }

    private resolveGizmoSnap(snap: GizmoSnap, obj: SceneObject, local: LocalTransform): SnapResult | null {
        const scene = this.store.scene;
        const world = getParentWorldMatrix(scene, obj.parentId).multiply(toMatrix(local));
        const exclude = [snap.id, ...getDescendantIds(scene, snap.id)];
        if (snap.kind === "fixture" && isFixtureVisualization(obj)) {
            const definition = assetCatalog.get(obj.modelId ?? "");
            if (definition?.category !== "fixtures") {
                return null;
            }
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            world.decompose(position, quaternion, scale);
            const modelScale = obj.modelScale ?? 1;
            const mount = definition.fixture.mountingPoints[0];
            const mountPoint = mount ? new THREE.Vector3(...mount.position).multiplyScalar(modelScale).applyMatrix4(world) : position;
            return this.snapResolver.resolveFixture(definition, modelScale * Math.max(scale.x, scale.y, scale.z), mountPoint, {
                exclude,
                currentQuaternion: quaternion,
            });
        }
        if (snap.kind === "truss" && isLibraryAsset(obj)) {
            const definition = assetCatalog.get(obj.assetId);
            return definition ? this.snapResolver.resolveTruss(definition, completeParams(definition, obj.params), world, { exclude }) : null;
        }
        return null;
    }

    // -----------------------------------------------------------------------------------------------------------
    // LED strip endpoint handles (FR-027)

    private clearEndpointHandles() {
        for (const handle of this.endpointHandles) {
            handle.removeFromParent();
            handle.geometry.dispose();
            (handle.material as THREE.Material).dispose();
        }
        this.endpointHandles.length = 0;
        this.endpointObjectId = null;
    }

    private selectedLedStripId(): string | null {
        if (this.store.selection.length !== 1) {
            return null;
        }
        const id = this.store.selection[0];
        const obj = this.store.scene.objects[id];
        if (!obj || !isFixtureVisualization(obj) || obj.visualizationType !== VisualizationType.LED_STRIP || !this.isPickable(id)) {
            return null;
        }
        return id;
    }

    private syncEndpointHandles() {
        const id = this.selectedLedStripId();
        if (id === this.endpointObjectId && (id === null || this.endpointHandles.length === 2)) {
            return;
        }
        if (this.attachedEndpoint) {
            this.detachEndpoint();
        }
        this.clearEndpointHandles();
        const o3d = id ? this.view.getObject3D(id) : undefined;
        if (!id || !o3d) {
            return;
        }
        this.endpointObjectId = id;
        for (const which of ["start", "end"] as const) {
            const handle = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 16, 12),
                new THREE.MeshBasicMaterial({ color: which === "start" ? 0x40ff80 : 0xff8040, depthTest: false })
            );
            handle.renderOrder = 10;
            handle.layers.set(EDITOR_LAYER);
            handle.userData.editorHelper = true;
            handle.userData.endpoint = which;
            o3d.add(handle);
            this.endpointHandles.push(handle);
        }
        this.positionEndpointHandles();
    }

    private positionEndpointHandles() {
        const id = this.endpointObjectId;
        const obj = id ? this.store.scene.objects[id] : undefined;
        if (!obj || !isFixtureVisualization(obj) || obj.visualizationType !== VisualizationType.LED_STRIP) {
            return;
        }
        const points = obj.config.path.points;
        for (const handle of this.endpointHandles) {
            // never fight the user while a handle is dragged
            if (handle === this.attachedEndpoint && this.drag) {
                continue;
            }
            // first and last path point (full path editing comes with the strip drawing tool, US4)
            const point = handle.userData.endpoint === "start" ? points[0] : points[points.length - 1];
            if (point) {
                handle.position.set(...point.position);
            }
        }
    }

    private attachEndpoint(handle: THREE.Mesh) {
        this.attachedEndpoint = handle;
        this.transform.detach();
        this.endpointTransform.attach(handle);
    }

    private detachEndpoint() {
        this.attachedEndpoint = null;
        this.endpointTransform.detach();
        this.refreshAttachment();
    }

    private previewEndpoint() {
        const handle = this.attachedEndpoint;
        const id = this.endpointObjectId;
        const obj = id ? this.store.scene.objects[id] : undefined;
        if (this.cancelling || !handle || !id || !obj || !isFixtureVisualization(obj) || obj.visualizationType !== VisualizationType.LED_STRIP) {
            return;
        }
        const config = JSON.parse(JSON.stringify(obj.config)) as typeof obj.config;
        const points = config.path.points;
        const index = handle.userData.endpoint === "start" ? 0 : points.length - 1;
        if (!points[index]) {
            return;
        }
        points[index] = { ...points[index], position: toVec3(handle.position) };
        this.store.previewPatches({ [id]: { config } as Partial<SceneObject> });
    }

    // -----------------------------------------------------------------------------------------------------------
    // frame hooks

    private readonly beforeRender = () => {
        this.updateAnimation();
        this.controls.update();
        if (this.attachedEndpoint === null) {
            this.positionEndpointHandles();
        }
        this.updateSelectionVisuals();
        this.updateLabelPositions();
    };

    private readonly afterRender = () => {
        this.renderAxesGizmo();
        this.labelRenderer.render(this.view.scene, this.view.camera);
    };
}
