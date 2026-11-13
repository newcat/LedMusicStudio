import type * as THREE from "three";

/** True if the object and all its ancestors are visible. */
export function isInVisibleHierarchy(obj: THREE.Object3D | null): boolean {
    for (let current = obj; current; current = current.parent) {
        if (!current.visible) {
            return false;
        }
    }
    return true;
}
