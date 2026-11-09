/**
 * Placement of library assets by drag & drop (feature 002, US1, contracts/library-ui.md → Placement).
 * While an asset tile is dragged over the viewport, a semi-transparent ghost stands on the surface under the pointer;
 * dropping creates the object through a store command (one undo step) and selects it.
 */
import * as THREE from "three";

import { assetCatalog, completeParams, instantiate, sizeOf, templateKey, type AssetDefinition } from "@/assetLibrary";
import { EDITOR_LAYER, type SceneView } from "@/visualization/sceneView";
import { createShapeGeometry } from "@/visualization/objectBuilders";
import { defaultShapeDimensions } from "../model/defaults";
import type { ShapeDimensions, Vec3 } from "../model/types";
import type { AddAssetOptions, useScene } from "../sceneStore";
import type { SnapResult } from "./snapping";

type SceneStore = ReturnType<typeof useScene>;

/** MIME type of the drag data set by AssetTile. */
export const ASSET_DRAG_TYPE = "application/x-lms-asset";

export interface SurfacePlacement {
    point: Vec3;
    normal: Vec3;
}

/**
 * Snapping hook (US5): returns the snapped world pose for the dragged asset at `point` (the ghost's unsnapped
 * position) or null. `event` is the dragover event (Ctrl disables snapping, FR-043).
 */
export type ResolveSnap = (assetId: string, point: THREE.Vector3, ray: THREE.Ray, event: DragEvent) => SnapResult | null;

// The drag data cannot be read during dragover, so the tile remembers the dragged id here.
let currentDragAssetId: string | null = null;

export function setCurrentDragAssetId(id: string | null) {
    currentDragAssetId = id;
}

export function getCurrentDragAssetId(): string | null {
    return currentDragAssetId;
}

/**
 * Adds a library asset through store commands only (FR-003): shapes become 001 shape objects, fixture models become
 * unlinked fixture visualizations and everything else a `libraryAsset`. Every command selects the new object.
 * With a snap result the object gets the snapped world transform and, when mounted, becomes a child of the target,
 * in the same command (one undo step, T082).
 */
export function addAssetById(store: SceneStore, assetId: string, placement: SurfacePlacement | null, snap?: SnapResult | null): string | null {
    const definition = assetCatalog.get(assetId);
    if (!definition) {
        return null;
    }
    if (definition.source.type === "shape") {
        return store.addShape(definition.source.shape, placement);
    }
    const options: AddAssetOptions | undefined = snap
        ? { parentId: snap.kind === "connect" ? null : snap.targetId, worldTransform: { position: snap.position, rotation: snap.rotation } }
        : undefined;
    if (definition.category === "fixtures") {
        return store.addFixtureModel(definition.id, placement, options);
    }
    return store.addLibraryAsset(definition.id, placement, options);
}

const GHOST_USER = "asset-drop-ghost";
const GHOST_OPACITY = 0.5;
const GHOST_RELEASE_DELAY_MS = 2000;
let ghostCounter = 0;

function ghostMaterial(source?: THREE.Material): THREE.Material {
    const color = source && "color" in source && source.color instanceof THREE.Color ? source.color : new THREE.Color(0x9e9e9e);
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        transparent: true,
        opacity: GHOST_OPACITY,
        depthWrite: false,
        side: source?.side ?? THREE.FrontSide,
    });
}

interface Ghost {
    assetId: string;
    root: THREE.Group;
    content: THREE.Object3D | null;
    /** Base point lift along the surface normal (spheres have their origin in the center). */
    lift: number;
    templateKey: string | null;
    /** Asset cache user id, unique per ghost. */
    userId: string;
    materials: THREE.Material[];
    geometries: THREE.BufferGeometry[];
    disposed: boolean;
}

/** Placement of the ghost and of the drop; computed by the overlay's surface raycast. */
export type SurfaceRaycast = (ndc: THREE.Vector2) => { placement: SurfacePlacement | null; ray: THREE.Ray };

export class AssetDropController {
    /** Snapping hook (US5). When set and it returns a result, the ghost uses the result's transform. */
    public resolveSnap: ResolveSnap | null = null;
    /** Called whenever the snap candidate changes (highlight and status hint). */
    public onSnapChange: ((snap: SnapResult | null) => void) | null = null;

    private ghost: Ghost | null = null;
    private lastPlacement: SurfacePlacement | null = null;
    private lastSnap: SnapResult | null = null;

    public constructor(
        private readonly view: SceneView,
        private readonly store: SceneStore,
        private readonly canvas: HTMLCanvasElement,
        private readonly raycast: SurfaceRaycast,
    ) {
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("dragend", this.onDragEnd);
    }

    public get active(): boolean {
        return this.ghost !== null;
    }

    public dragOver(event: DragEvent) {
        if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes(ASSET_DRAG_TYPE)) {
            return;
        }
        const assetId = currentDragAssetId;
        const definition = assetId ? assetCatalog.get(assetId) : undefined;
        if (!definition) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";

        if (this.ghost?.assetId !== definition.id) {
            this.removeGhost();
            this.ghost = this.createGhost(definition);
        }

        const { placement, ray } = this.raycast(this.ndcFromEvent(event));
        const resolved = placement ?? this.floorPlacement(ray);
        this.lastPlacement = resolved;
        const point = new THREE.Vector3(...resolved.point);
        this.lastSnap = this.resolveSnap?.(definition.id, point, ray, event) ?? null;
        this.onSnapChange?.(this.lastSnap);
        this.positionGhost(resolved, this.lastSnap);
    }

    public dragLeave() {
        this.removeGhost();
    }

    public drop(event: DragEvent) {
        if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes(ASSET_DRAG_TYPE)) {
            return;
        }
        event.preventDefault();
        const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE) || currentDragAssetId;
        let placement = this.lastPlacement;
        // Ctrl pressed after the last dragover still places freely (FR-043)
        let snap = event.ctrlKey ? null : this.lastSnap;
        if (!this.ghost) {
            // drop without a preceding dragover (should not happen): place under the pointer
            const { placement: hit, ray } = this.raycast(this.ndcFromEvent(event));
            placement = hit ?? this.floorPlacement(ray);
            snap = null;
        }
        this.removeGhost();
        currentDragAssetId = null;
        if (assetId) {
            addAssetById(this.store, assetId, placement, snap);
        }
    }

    /** Removes the ghost; returns true if a drag was cancelled. */
    public cancel(): boolean {
        const had = this.ghost !== null;
        this.removeGhost();
        return had;
    }

    public dispose() {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("dragend", this.onDragEnd);
        this.removeGhost();
    }

    // -----------------------------------------------------------------------------------------------------------

    private readonly onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            this.cancel();
        }
    };

    private readonly onDragEnd = () => {
        this.removeGhost();
    };

    private ndcFromEvent(event: MouseEvent): THREE.Vector2 {
        const rect = this.canvas.getBoundingClientRect();
        return new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    }

    /** Over empty space the asset stands on the floor plane y = 0; if the ray misses it, at the origin. */
    private floorPlacement(ray: THREE.Ray): SurfacePlacement {
        const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        return { point: hit ? [hit.x, 0, hit.z] : [0, 0, 0], normal: [0, 1, 0] };
    }

    private createGhost(definition: AssetDefinition): Ghost {
        const root = new THREE.Group();
        root.name = "asset-drop-ghost";
        root.userData.editorHelper = true;
        const ghost: Ghost = {
            assetId: definition.id,
            root,
            content: null,
            lift: 0,
            templateKey: null,
            userId: `${GHOST_USER}:${++ghostCounter}`,
            materials: [],
            geometries: [],
            disposed: false,
        };
        this.view.scene.add(root);

        if (definition.source.type === "shape") {
            const dims = defaultShapeDimensions(definition.source.shape) as ShapeDimensions;
            const geometry = createShapeGeometry(dims);
            const material = ghostMaterial();
            if (dims.shape === "plane") {
                (material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
            }
            ghost.geometries.push(geometry);
            ghost.materials.push(material);
            ghost.lift = dims.shape === "sphere" ? dims.dimensions.radius : 0;
            this.setGhostContent(ghost, new THREE.Mesh(geometry, material));
            return ghost;
        }

        // wireframe box of the asset size until the template is ready
        const [w, h, d] = sizeOf(definition, completeParams(definition, {}));
        const boxGeometry = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
        const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x9e9e9e, wireframe: true, transparent: true, opacity: GHOST_OPACITY });
        ghost.geometries.push(boxGeometry);
        ghost.materials.push(boxMaterial);
        this.setGhostContent(ghost, new THREE.Mesh(boxGeometry, boxMaterial));

        // same key as the placed object (default params, no variant, material or color), so the template is shared
        const params = completeParams(definition, {});
        ghost.templateKey = templateKey(definition.id, params, null, null, null);
        void this.view.assets.acquire({ assetId: definition.id, params }, ghost.userId).then((template) => {
            if (ghost.disposed || !template) {
                return;
            }
            const instance = instantiate(template);
            instance.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = Array.isArray(child.material)
                        ? child.material.map((m: THREE.Material) => this.trackMaterial(ghost, ghostMaterial(m)))
                        : this.trackMaterial(ghost, ghostMaterial(child.material as THREE.Material));
                }
            });
            this.setGhostContent(ghost, instance);
        });
        return ghost;
    }

    private trackMaterial(ghost: Ghost, material: THREE.Material): THREE.Material {
        ghost.materials.push(material);
        return material;
    }

    private setGhostContent(ghost: Ghost, content: THREE.Object3D) {
        if (ghost.content) {
            ghost.root.remove(ghost.content);
        }
        content.traverse((o) => {
            o.layers.set(EDITOR_LAYER);
            o.raycast = () => undefined;
            o.userData.editorHelper = true;
        });
        ghost.root.add(content);
        ghost.content = content;
    }

    private positionGhost(placement: SurfacePlacement, snap: SnapResult | null) {
        const ghost = this.ghost;
        if (!ghost) {
            return;
        }
        if (snap) {
            ghost.root.position.set(...snap.position);
            ghost.root.quaternion.setFromEuler(
                new THREE.Euler(THREE.MathUtils.degToRad(snap.rotation[0]), THREE.MathUtils.degToRad(snap.rotation[1]), THREE.MathUtils.degToRad(snap.rotation[2]), "XYZ")
            );
            ghost.root.scale.set(1, 1, 1);
            return;
        }
        const [px, py, pz] = placement.point;
        const [nx, ny, nz] = placement.normal;
        ghost.root.position.set(px + nx * ghost.lift, py + ny * ghost.lift, pz + nz * ghost.lift);
        // upright, rotation 0 (FR-004)
        ghost.root.quaternion.identity();
        ghost.root.scale.set(1, 1, 1);
    }

    private removeGhost() {
        const ghost = this.ghost;
        this.ghost = null;
        this.lastPlacement = null;
        if (this.lastSnap) {
            this.lastSnap = null;
            this.onSnapChange?.(null);
        }
        if (!ghost) {
            return;
        }
        ghost.disposed = true;
        ghost.root.removeFromParent();
        ghost.materials.forEach((m) => m.dispose());
        ghost.geometries.forEach((g) => g.dispose());
        const key = ghost.templateKey;
        const userId = ghost.userId;
        if (key) {
            // released a little later, so a dropped object can take over the template instead of rebuilding it
            setTimeout(() => this.view.assets.release(key, userId), GHOST_RELEASE_DELAY_MS);
        }
    }
}
