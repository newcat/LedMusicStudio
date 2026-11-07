import * as THREE from "three";

import type { SceneObject, ShapeObject } from "@/scene/model/types";
import { isShape } from "@/scene/model/types";
import { createLedLitMaterial, LedStripLighting } from "./ledLitMaterial";

export interface BuildContext {
    lighting: LedStripLighting;
}

export interface Disposable {
    dispose(): void;
}

/** Marks every Object3D that represents a scene object, so picking can resolve hits upwards. */
export const SCENE_OBJECT_ID = "sceneObjectId";
export const SCENE_OBJECT_KIND = "kind";
const DISPOSABLES = "disposables";
const SHAPE_KEY = "shapeKey";

function track(o3d: THREE.Object3D, disposable: Disposable) {
    ((o3d.userData[DISPOSABLES] ??= []) as Disposable[]).push(disposable);
}

function createShapeGeometry(obj: ShapeObject): THREE.BufferGeometry {
    switch (obj.shape) {
        case "box": {
            const { width, height, depth } = obj.dimensions;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            geometry.translate(0, height / 2, 0);
            return geometry;
        }
        case "cylinder": {
            const { radius, height } = obj.dimensions;
            const geometry = new THREE.CylinderGeometry(radius, radius, height, 48);
            geometry.translate(0, height / 2, 0);
            return geometry;
        }
        case "plane": {
            const { width, depth } = obj.dimensions;
            const geometry = new THREE.PlaneGeometry(width, depth);
            geometry.rotateX(-Math.PI / 2);
            return geometry;
        }
        case "sphere":
            return new THREE.SphereGeometry(obj.dimensions.radius, 48, 24);
    }
}

function shapeKey(obj: ShapeObject) {
    return `${obj.shape}:${JSON.stringify(obj.dimensions)}`;
}

export function createPlaceholder(label: string, color = 0xff3030): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    geometry.translate(0, 0.25, 0);
    const material = new THREE.MeshBasicMaterial({ color, wireframe: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.placeholderLabel = label;
    track(mesh, geometry);
    track(mesh, material);
    return mesh;
}

export function applyTransform(o3d: THREE.Object3D, obj: Pick<SceneObject, "position" | "rotation" | "scale">) {
    o3d.position.set(obj.position[0], obj.position[1], obj.position[2]);
    o3d.rotation.set(
        THREE.MathUtils.degToRad(obj.rotation[0]),
        THREE.MathUtils.degToRad(obj.rotation[1]),
        THREE.MathUtils.degToRad(obj.rotation[2]),
        "XYZ"
    );
    o3d.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);
}

/**
 * Builds the Object3D for a scene object. Children are not built here: the view re-parents the Object3Ds so that
 * the scene graph mirrors `parentId`.
 */
export function buildObject3D(obj: SceneObject, ctx: BuildContext): THREE.Object3D {
    let o3d: THREE.Object3D;

    if (isShape(obj)) {
        const geometry = createShapeGeometry(obj);
        const material = createLedLitMaterial(ctx.lighting, {
            color: obj.color,
            side: obj.shape === "plane" ? THREE.DoubleSide : THREE.FrontSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData[SHAPE_KEY] = shapeKey(obj);
        o3d = mesh;
        track(o3d, material);
    } else if (obj.kind === "group" || obj.kind === "fixtureVisualization") {
        // fixture visualizations get their renderer from the view
        o3d = new THREE.Group();
    } else if (obj.kind === "importedModel") {
        // loading placeholder, replaced by the view when the asset is available (US7)
        o3d = new THREE.Group();
        o3d.add(createPlaceholder("Loading model…", 0x909090));
    } else {
        // unknown kind (written by a newer version): keep it visible and transformable
        o3d = new THREE.Group();
        o3d.add(createPlaceholder((obj as { kind: string }).kind));
    }

    o3d.userData[SCENE_OBJECT_ID] = obj.id;
    o3d.userData[SCENE_OBJECT_KIND] = (obj as { kind: string }).kind;
    o3d.name = obj.name;
    applyTransform(o3d, obj);
    return o3d;
}

/** Applies transform and kind-specific properties in place. Returns false if the object has to be rebuilt. */
export function updateObject3D(o3d: THREE.Object3D, obj: SceneObject, ctx: BuildContext): boolean {
    if (o3d.userData[SCENE_OBJECT_KIND] !== (obj as { kind: string }).kind) {
        return false;
    }
    o3d.name = obj.name;
    applyTransform(o3d, obj);

    if (isShape(obj) && o3d instanceof THREE.Mesh) {
        const key = shapeKey(obj);
        if (o3d.userData[SHAPE_KEY] !== key) {
            o3d.geometry.dispose();
            o3d.geometry = createShapeGeometry(obj);
            o3d.userData[SHAPE_KEY] = key;
            const side = obj.shape === "plane" ? THREE.DoubleSide : THREE.FrontSide;
            (o3d.material as unknown as THREE.MeshPhysicalMaterial).side = side;
        }
        (o3d.material as unknown as THREE.MeshPhysicalMaterial).color.set(obj.color);
    }
    void ctx;
    return true;
}

/** Frees the resources owned by this scene object's own Object3D (not by the Object3Ds of its children). */
export function disposeObject3D(o3d: THREE.Object3D) {
    const disposeOwn = (target: THREE.Object3D) => {
        const list = target.userData[DISPOSABLES] as Disposable[] | undefined;
        list?.forEach((d) => d.dispose());
        target.userData[DISPOSABLES] = [];
    };
    disposeOwn(o3d);
    if (o3d instanceof THREE.Mesh) {
        o3d.geometry.dispose();
    }
    for (const child of o3d.children) {
        // only placeholder helpers are built into the object itself
        if (!child.userData[SCENE_OBJECT_ID] && !child.userData.sharedResources && !(child as { isFixtureRenderer?: boolean }).isFixtureRenderer) {
            child.traverse((c) => {
                disposeOwn(c);
                if (c instanceof THREE.Mesh) {
                    c.geometry.dispose();
                }
            });
        }
    }
}
