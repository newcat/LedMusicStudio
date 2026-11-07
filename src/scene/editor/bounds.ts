import * as THREE from "three";

const tmpBox = new THREE.Box3();

/**
 * World-space bounds of an Object3D and all its descendants. Beams and other helpers flagged with
 * `userData.excludeFromBounds` (or `editorHelper`) are ignored. Returns an empty box if there is no geometry.
 */
export function computeObjectBounds(object: THREE.Object3D, target = new THREE.Box3()): THREE.Box3 {
    target.makeEmpty();
    object.updateWorldMatrix(true, true);
    object.traverseVisible((child) => {
        if (child.userData.excludeFromBounds || child.userData.editorHelper) {
            return;
        }
        if (child instanceof THREE.Mesh && child.geometry) {
            const geometry = child.geometry as THREE.BufferGeometry;
            if (geometry.boundingBox === null) {
                geometry.computeBoundingBox();
            }
            if (geometry.boundingBox && !geometry.boundingBox.isEmpty()) {
                tmpBox.copy(geometry.boundingBox).applyMatrix4(child.matrixWorld);
                target.union(tmpBox);
            }
        }
    });
    return target;
}
