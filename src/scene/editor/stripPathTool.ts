import * as THREE from "three";

import { EDITOR_LAYER, type SceneView } from "@/visualization/sceneView";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import type { LedStripVisualizationConfig, StripPath, StripPathPoint } from "@/visualization/fixtureVisualizations/ledStrip/types";
import type { StripPathToolMode } from "@/visualization/fixtureVisualizations/ledStrip/stripPathToolApi";
import { isFixtureVisualization, type Vec3 } from "../model/types";
import type { ObjectStates, useScene } from "../sceneStore";
import { emitSceneToast } from "../toastBus";

type SceneStore = ReturnType<typeof useScene>;
interface Ndc {
    x: number;
    y: number;
}

/** New points sit this far (meters) above the clicked surface along its normal. */
const SURFACE_OFFSET = 0.005;
/** A click closer than this (meters) to the last point adds no point (the second click of a double-click). */
const DUPLICATE_DISTANCE = 0.001;
/** Samples per segment of the curve preview. */
const PREVIEW_SAMPLES = 16;
/** Handle radius relative to the camera distance, so handles keep their screen size. */
const POINT_HANDLE_SIZE = 0.012;
const MID_HANDLE_SIZE = 0.008;

const LINE_COLOR = 0x00e5ff;
const POINT_COLOR = 0xffd600;
const SELECTED_POINT_COLOR = 0xff6d00;
const MID_COLOR = 0x9e9e9e;

export const DRAW_HINT = "Click to add points · Shift: straight · Backspace: undo point · Enter/double-click: finish · Esc: cancel";
export const EDIT_HINT = "Drag points along surfaces · Click a midpoint to insert · Delete: remove point · Esc: done";

/** What the tool needs from its host (`EditorOverlay`). */
export interface StripPathToolHost {
    readonly view: SceneView;
    readonly store: SceneStore;
    setHint(text: string | null): void;
    setCursor(cursor: string): void;
    /** Called once when the tool ends (finished, cancelled or left). */
    onEnd(tool: StripPathTool): void;
}

interface WorldPoint {
    position: THREE.Vector3;
    normal: THREE.Vector3;
}

interface HandleDrag {
    index: number;
    before: ObjectStates;
    /** pointer position not yet applied (applied once per frame) */
    pending: Ndc | null;
    moved: boolean;
}

function toVec3(v: THREE.Vector3): Vec3 {
    return [v.x, v.y, v.z];
}

function clonePath(path: StripPath): StripPath {
    return JSON.parse(JSON.stringify(path)) as StripPath;
}

/**
 * LED strip path tool (feature 003, research R17, data-model §6), hosted by `EditorOverlay`:
 * - drawing: clicks on surfaces append points, Enter/double-click commits the path ("Draw LED strip"), Esc cancels;
 * - editing: point handles are dragged along surfaces, midpoint handles insert points, Delete removes the selected
 *   point; every change is one undo step.
 * Points are stored in the strip's object-local space. All helpers live on the editor layer.
 */
export class StripPathTool {
    private objectIdValue = "";
    private modeValue: StripPathToolMode = "drawing";
    private isNew = false;
    private ended = false;

    private readonly group = new THREE.Group();
    private readonly raycaster = new THREE.Raycaster();

    // drawing
    private readonly points: WorldPoint[] = [];
    private cursor: WorldPoint | null = null;
    private lastNdc: Ndc | null = null;
    private shift = false;
    private readonly lineMaterial = new THREE.LineBasicMaterial({ color: LINE_COLOR, depthTest: false, toneMapped: false, transparent: true });
    private readonly markerMaterial = new THREE.PointsMaterial({
        color: POINT_COLOR,
        size: 7,
        sizeAttenuation: false,
        depthTest: false,
        toneMapped: false,
        transparent: true,
    });
    private line: THREE.Line | null = null;
    private markers: THREE.Points | null = null;

    // editing
    private readonly handleGeometry = new THREE.SphereGeometry(1, 16, 12);
    private readonly pointMaterial = new THREE.MeshBasicMaterial({ color: POINT_COLOR, depthTest: false, toneMapped: false, transparent: true });
    private readonly selectedMaterial = new THREE.MeshBasicMaterial({ color: SELECTED_POINT_COLOR, depthTest: false, toneMapped: false, transparent: true });
    private readonly midMaterial = new THREE.MeshBasicMaterial({ color: MID_COLOR, depthTest: false, toneMapped: false, transparent: true });
    private readonly pointHandles: THREE.Mesh[] = [];
    private readonly midHandles: THREE.Mesh[] = [];
    private selectedIndex: number | null = null;
    private drag: HandleDrag | null = null;
    private pendingInsert: number | null = null;

    public constructor(private readonly host: StripPathToolHost) {
        this.group.userData.editorHelper = true;
        this.group.layers.set(EDITOR_LAYER);
        this.raycaster.layers.set(EDITOR_LAYER);
        host.view.scene.add(this.group);
    }

    // -----------------------------------------------------------------------------------------------------------
    // public API

    public get objectId(): string {
        return this.objectIdValue;
    }

    public get mode(): StripPathToolMode {
        return this.modeValue;
    }

    public get hint(): string {
        return this.modeValue === "drawing" ? DRAW_HINT : EDIT_HINT;
    }

    public get isDragging(): boolean {
        return this.drag !== null;
    }

    /** Enters draw mode. `isNew`: the strip was created for this drawing and is removed again on cancel. */
    public start(objectId: string, options: { isNew: boolean }) {
        this.objectIdValue = objectId;
        this.modeValue = "drawing";
        this.isNew = options.isNew;
        this.host.setHint(DRAW_HINT);
        this.host.setCursor("crosshair");
    }

    /** Enters path editing mode for the strip. */
    public startEditing(objectId: string) {
        this.objectIdValue = objectId;
        this.modeValue = "editing";
        this.selectedIndex = null;
        this.host.setHint(EDIT_HINT);
        this.host.setCursor("");
        this.syncHandles();
    }

    /** Leaves the tool: drawing is cancelled (Esc behavior), editing is left. */
    public leave() {
        if (this.modeValue === "drawing") {
            this.cancel();
        } else {
            this.cancelDrag();
            this.end();
        }
    }

    /** Cancels a running handle drag without a history entry. Returns true if one was running. */
    public cancelDrag(): boolean {
        if (!this.drag) {
            return false;
        }
        const drag = this.drag;
        this.drag = null;
        this.host.store.cancelPreview(drag.before);
        return true;
    }

    /** Removes the helpers without touching the scene (the host is disposed). */
    public dispose() {
        this.ended = true;
        this.drag = null;
        this.group.removeFromParent();
        this.clearLine();
        this.clearHandles();
        this.handleGeometry.dispose();
        for (const material of [this.lineMaterial, this.markerMaterial, this.pointMaterial, this.selectedMaterial, this.midMaterial]) {
            material.dispose();
        }
    }

    // -----------------------------------------------------------------------------------------------------------
    // events (forwarded by the host while the tool is active)

    /** Primary button pressed. Returns true if the tool takes the press (handle drag): the camera must not move. */
    public onPointerDown(ndc: Ndc): boolean {
        if (this.modeValue !== "editing") {
            return false;
        }
        this.pendingInsert = null;
        const handle = this.pickHandle(ndc);
        if (!handle) {
            return false;
        }
        if (handle.kind === "point") {
            this.selectedIndex = handle.index;
            this.drag = { index: handle.index, before: this.host.store.captureBeforeStates([this.objectIdValue]), pending: null, moved: false };
        } else {
            this.pendingInsert = handle.index;
        }
        return true;
    }

    public onPointerMove(ndc: Ndc, event: PointerEvent) {
        this.lastNdc = ndc;
        this.shift = event.shiftKey;
        if (this.modeValue === "drawing") {
            this.updateCursor();
        } else if (this.drag) {
            this.drag.pending = ndc;
        }
    }

    /** Pointer released; `isClick`: primary button without movement. */
    public onPointerUp(ndc: Ndc, event: PointerEvent, isClick: boolean) {
        this.lastNdc = ndc;
        this.shift = event.shiftKey;
        if (this.modeValue === "drawing") {
            if (isClick) {
                this.addPoint();
            }
            return;
        }
        if (this.drag) {
            const drag = this.drag;
            this.applyDrag();
            this.drag = null;
            if (drag.moved) {
                this.host.store.commitPreview(drag.before, "Move strip point");
            }
            return;
        }
        if (this.pendingInsert !== null) {
            const segment = this.pendingInsert;
            this.pendingInsert = null;
            if (isClick) {
                this.insertPoint(segment);
            }
            return;
        }
        if (isClick) {
            // a click into empty space leaves edit mode
            this.end();
        }
    }

    public onDoubleClick() {
        if (this.modeValue === "drawing") {
            this.finish();
        }
    }

    /** Key down or up. Returns true if the tool used the key (the editor shortcuts must not see it). */
    public onKey(event: KeyboardEvent): boolean {
        if (event.key === "Shift") {
            this.shift = event.type === "keydown";
            if (this.modeValue === "drawing") {
                this.updateCursor();
            }
            return false;
        }
        if (event.type !== "keydown") {
            return false;
        }
        const key = event.key.toLowerCase();
        const mod = event.ctrlKey || event.metaKey;
        if (this.modeValue === "drawing") {
            if (mod && (key === "z" || key === "y")) {
                // undo inside the drawing removes the last point; the history is untouched until the drawing ends
                if (key === "z" && !event.shiftKey) {
                    this.removeLastPoint();
                }
                return true;
            }
            switch (key) {
                case "backspace":
                case "delete":
                    this.removeLastPoint();
                    return true;
                case "enter":
                    this.finish();
                    return true;
                case "escape":
                    this.cancel();
                    return true;
                default:
                    return false;
            }
        }
        switch (key) {
            case "escape":
                if (!this.cancelDrag()) {
                    this.end();
                }
                return true;
            case "backspace":
            case "delete":
                if (!this.drag) {
                    this.removeSelectedPoint();
                }
                return true;
            default:
                return false;
        }
    }

    /** Selection changed outside the tool: path editing ends when the strip is no longer the only selected object. */
    public onSelectionChanged(selection: readonly string[]) {
        if (this.modeValue === "editing" && !(selection.length === 1 && selection[0] === this.objectIdValue)) {
            this.leave();
        }
    }

    /** Once per frame, before rendering. */
    public update() {
        if (this.ended) {
            return;
        }
        if (!this.currentPath() || !this.host.view.getObject3D(this.objectIdValue)) {
            // the strip was deleted (e.g. undo of its creation)
            this.drag = null;
            this.end();
            return;
        }
        if (this.modeValue === "editing") {
            this.applyDrag();
            this.syncHandles();
        }
    }

    // -----------------------------------------------------------------------------------------------------------
    // shared helpers

    private currentPath(): StripPath | null {
        const obj = this.host.store.scene.objects[this.objectIdValue];
        if (!obj || !isFixtureVisualization(obj) || obj.visualizationType !== VisualizationType.LED_STRIP) {
            return null;
        }
        return (obj.config as LedStripVisualizationConfig).path ?? null;
    }

    private objectMatrix(): THREE.Matrix4 | null {
        const o3d = this.host.view.getObject3D(this.objectIdValue);
        if (!o3d) {
            return null;
        }
        o3d.updateWorldMatrix(true, false);
        return o3d.matrixWorld;
    }

    /** Surface point under the pointer, lifted by 5 mm along the surface normal (world space). */
    private surfacePoint(ndc: Ndc): WorldPoint | null {
        const hit = this.host.view.raycastSurfaces(ndc);
        if (!hit) {
            return null;
        }
        const normal = hit.normal.clone().normalize();
        return { position: hit.point.clone().addScaledVector(normal, SURFACE_OFFSET), normal };
    }

    /** World point → path point in the strip's object-local frame (normals transform with the transposed matrix). */
    private toLocal(point: WorldPoint, matrix: THREE.Matrix4): StripPathPoint {
        const position = point.position.clone().applyMatrix4(matrix.clone().invert());
        const normal = point.normal.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(matrix).transpose());
        if (normal.lengthSq() < 1e-12) {
            normal.set(0, 1, 0);
        }
        normal.normalize();
        return { position: toVec3(position), normal: toVec3(normal) };
    }

    private end() {
        if (this.ended) {
            return;
        }
        this.dispose();
        this.host.setHint(null);
        this.host.setCursor("");
        this.host.onEnd(this);
    }

    // -----------------------------------------------------------------------------------------------------------
    // drawing

    private updateCursor() {
        const hit = this.lastNdc ? this.surfacePoint(this.lastNdc) : null;
        const last = this.points[this.points.length - 1];
        if (hit && last && this.shift) {
            // Shift: the segment runs along the closest world axis
            const delta = hit.position.clone().sub(last.position);
            const abs = [Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z)];
            const axis = abs.indexOf(Math.max(...abs));
            const locked = last.position.clone();
            locked.setComponent(axis, locked.getComponent(axis) + delta.getComponent(axis));
            hit.position.copy(locked);
        }
        this.cursor = hit;
        this.rebuildLine();
    }

    private addPoint() {
        this.updateCursor();
        const cursor = this.cursor;
        if (!cursor) {
            return;
        }
        const last = this.points[this.points.length - 1];
        if (last && last.position.distanceTo(cursor.position) < DUPLICATE_DISTANCE) {
            return;
        }
        this.points.push({ position: cursor.position.clone(), normal: cursor.normal.clone() });
        this.rebuildLine();
    }

    private removeLastPoint() {
        if (this.points.length > 0) {
            this.points.pop();
            this.rebuildLine();
        }
    }

    /** Needs ≥ 2 points, otherwise it behaves like Esc. Commits one undo step and selects the strip. */
    private finish() {
        const matrix = this.objectMatrix();
        const current = this.currentPath();
        if (this.points.length < 2 || !matrix || !current) {
            this.cancel();
            return;
        }
        const path: StripPath = {
            points: this.points.map((p) => this.toLocal(p, matrix)),
            interpolation: current.interpolation,
            closed: current.closed,
        };
        const store = this.host.store;
        if (!store.setStripPath(this.objectIdValue, path, "Draw LED strip")) {
            this.cancel();
            return;
        }
        if (this.isNew) {
            store.mergeWithAddEntry(this.objectIdValue, "Draw LED strip");
        }
        store.select([this.objectIdValue]);
        this.end();
    }

    /** A new strip is removed again, an existing strip keeps its path. */
    private cancel() {
        if (this.ended) {
            return;
        }
        const id = this.objectIdValue;
        const removeNew = this.modeValue === "drawing" && this.isNew && !!this.host.store.scene.objects[id];
        this.end();
        if (removeNew) {
            this.host.store.discardAddedObject(id);
        }
    }

    private clearLine() {
        for (const object of [this.line, this.markers]) {
            if (object) {
                object.removeFromParent();
                object.geometry.dispose();
            }
        }
        this.line = null;
        this.markers = null;
    }

    /** Ghost of the strip: the points so far plus the cursor, as straight segments or the smooth curve. */
    private rebuildLine() {
        this.clearLine();
        const vertices = this.points.map((p) => p.position);
        if (this.cursor) {
            vertices.push(this.cursor.position);
        }
        const path = this.currentPath();
        const closed = !!path?.closed && vertices.length >= 3;
        let linePoints: THREE.Vector3[] = vertices;
        if (path?.interpolation === "curve" && vertices.length >= 2) {
            const curve = new THREE.CatmullRomCurve3(vertices, closed, "centripetal");
            const segments = closed ? vertices.length : vertices.length - 1;
            linePoints = curve.getPoints(segments * PREVIEW_SAMPLES);
        } else if (closed) {
            linePoints = [...vertices, vertices[0]];
        }
        if (linePoints.length >= 2) {
            this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), this.lineMaterial);
            this.line.renderOrder = 10;
            this.line.layers.set(EDITOR_LAYER);
            this.line.frustumCulled = false;
            this.group.add(this.line);
        }
        if (this.points.length > 0) {
            this.markers = new THREE.Points(new THREE.BufferGeometry().setFromPoints(this.points.map((p) => p.position)), this.markerMaterial);
            this.markers.renderOrder = 11;
            this.markers.layers.set(EDITOR_LAYER);
            this.markers.frustumCulled = false;
            this.group.add(this.markers);
        }
    }

    // -----------------------------------------------------------------------------------------------------------
    // editing

    private clearHandles() {
        for (const handle of [...this.pointHandles, ...this.midHandles]) {
            handle.removeFromParent();
        }
        this.pointHandles.length = 0;
        this.midHandles.length = 0;
    }

    private createHandle(kind: "point" | "mid"): THREE.Mesh {
        const handle = new THREE.Mesh(this.handleGeometry, kind === "point" ? this.pointMaterial : this.midMaterial);
        handle.renderOrder = kind === "point" ? 12 : 11;
        handle.layers.set(EDITOR_LAYER);
        handle.userData.editorHelper = true;
        handle.userData.handleKind = kind;
        this.group.add(handle);
        return handle;
    }

    /** Positions of the local path points and segment midpoints (on the curve if smooth), in object-local space. */
    private midpoints(path: StripPath): THREE.Vector3[] {
        const vertices = path.points.map((p) => new THREE.Vector3(...p.position));
        const count = vertices.length;
        const segments = path.closed ? count : count - 1;
        const result: THREE.Vector3[] = [];
        const curve = path.interpolation === "curve" && count >= 2 ? new THREE.CatmullRomCurve3(vertices, path.closed, "centripetal") : null;
        for (let i = 0; i < segments; i++) {
            if (curve) {
                result.push(curve.getPoint((i + 0.5) / segments));
            } else {
                result.push(vertices[i].clone().add(vertices[(i + 1) % count]).multiplyScalar(0.5));
            }
        }
        return result;
    }

    /** Creates or removes handles to match the path and places them (constant screen size). */
    private syncHandles() {
        const path = this.currentPath();
        const matrix = this.objectMatrix();
        if (!path || !matrix) {
            return;
        }
        const count = path.points.length;
        if (this.selectedIndex !== null && this.selectedIndex >= count) {
            this.selectedIndex = null;
        }
        const mids = this.midpoints(path);
        while (this.pointHandles.length < count) this.pointHandles.push(this.createHandle("point"));
        while (this.pointHandles.length > count) this.pointHandles.pop()!.removeFromParent();
        while (this.midHandles.length < mids.length) this.midHandles.push(this.createHandle("mid"));
        while (this.midHandles.length > mids.length) this.midHandles.pop()!.removeFromParent();

        const camera = this.host.view.camera;
        path.points.forEach((point, i) => {
            const handle = this.pointHandles[i];
            handle.position.set(...point.position).applyMatrix4(matrix);
            handle.scale.setScalar(Math.max(camera.position.distanceTo(handle.position) * POINT_HANDLE_SIZE, 1e-3));
            handle.material = i === this.selectedIndex ? this.selectedMaterial : this.pointMaterial;
            handle.userData.index = i;
        });
        mids.forEach((mid, i) => {
            const handle = this.midHandles[i];
            handle.position.copy(mid).applyMatrix4(matrix);
            handle.scale.setScalar(Math.max(camera.position.distanceTo(handle.position) * MID_HANDLE_SIZE, 1e-3));
            handle.userData.index = i;
        });
        this.group.updateMatrixWorld(true);
    }

    private pickHandle(ndc: Ndc): { kind: "point" | "mid"; index: number } | null {
        this.syncHandles();
        this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.host.view.camera);
        // point handles win over midpoint handles
        for (const handles of [this.pointHandles, this.midHandles]) {
            const hit = this.raycaster.intersectObjects(handles, false)[0];
            if (hit) {
                return { kind: hit.object.userData.handleKind as "point" | "mid", index: hit.object.userData.index as number };
            }
        }
        return null;
    }

    /** Applies the latest pointer position of a point drag as a preview (no history entry). */
    private applyDrag() {
        const drag = this.drag;
        if (!drag?.pending) {
            return;
        }
        const ndc = drag.pending;
        drag.pending = null;
        const hit = this.surfacePoint(ndc);
        const matrix = this.objectMatrix();
        const current = this.currentPath();
        if (!hit || !matrix || !current || !current.points[drag.index]) {
            return;
        }
        const path = clonePath(current);
        path.points[drag.index] = this.toLocal(hit, matrix);
        if (this.host.store.setStripPath(this.objectIdValue, path, undefined, { preview: true })) {
            drag.moved = true;
        }
    }

    private insertPoint(segment: number) {
        const current = this.currentPath();
        if (!current) {
            return;
        }
        const path = clonePath(current);
        const count = path.points.length;
        const a = path.points[segment];
        const b = path.points[(segment + 1) % count];
        const mid = this.midpoints(path)[segment];
        if (!a || !b || !mid) {
            return;
        }
        const normal = new THREE.Vector3(...a.normal).add(new THREE.Vector3(...b.normal));
        if (normal.lengthSq() < 1e-12) {
            normal.set(...a.normal);
        }
        normal.normalize();
        path.points.splice(segment + 1, 0, { position: toVec3(mid), normal: toVec3(normal) });
        if (this.host.store.setStripPath(this.objectIdValue, path, "Insert strip point")) {
            this.selectedIndex = segment + 1;
        }
    }

    private removeSelectedPoint() {
        const current = this.currentPath();
        const index = this.selectedIndex;
        if (!current || index === null || !current.points[index]) {
            return;
        }
        if (current.points.length <= 2) {
            emitSceneToast({ severity: "info", summary: "Cannot remove point", detail: "An LED strip needs at least 2 points.", life: 3000 });
            return;
        }
        const path = clonePath(current);
        path.points.splice(index, 1);
        if (this.host.store.setStripPath(this.objectIdValue, path, "Remove strip point")) {
            this.selectedIndex = null;
        }
    }
}
