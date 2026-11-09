/**
 * Small geometry helpers shared by the decoration builders (feature 002). They only add Three.js geometry tagged
 * with a material slot, as allowed by contracts/fixture-model-authoring.md section 3.
 */
import * as THREE from "three";
import type { BuilderKit, MaterialSlot } from "../../types";

function slotMesh(geometry: THREE.BufferGeometry, slot: MaterialSlot): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry);
    mesh.userData.slot = slot;
    return mesh;
}

/**
 * A prism with the side profile `profile` (a simple polygon of [z, y] pairs, either winding), extruded along X and
 * centered on x = 0.
 */
export function prism(profile: Array<[number, number]>, width: number, slot: MaterialSlot): THREE.Mesh {
    const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
    // shape x → world z, extrusion (0..width along z) → world x (−width..0)
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(width / 2, 0, 0);
    return slotMesh(geometry, slot);
}

/** A capsule of radius `radius` between `from` and `to` (a lathe with hemispherical ends). */
export function capsule(
    kit: BuilderKit,
    from: [number, number, number],
    to: [number, number, number],
    radius: number,
    slot: MaterialSlot,
    segments = 10,
): THREE.Mesh {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const length = Math.max(dir.length(), 1e-6);
    const steps = 3;
    // runs from y = −radius to length + radius, so the cap centers sit on `from` and `to`
    const profile: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
        const angle = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
        profile.push([i === 0 ? 0 : radius * Math.cos(angle), radius * Math.sin(angle)]);
    }
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * (Math.PI / 2);
        profile.push([i === steps ? 0 : radius * Math.cos(angle), length + radius * Math.sin(angle)]);
    }
    const mesh = kit.lathe(profile, slot, segments);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.position.copy(a);
    return mesh;
}

/** A sphere of radius `radius` centered at `center` (lathe, so the slot handling matches the kit). */
export function sphere(kit: BuilderKit, center: [number, number, number], radius: number, slot: MaterialSlot, segments = 12): THREE.Mesh {
    const steps = Math.max(4, Math.round(segments / 2));
    const profile: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
        const angle = -Math.PI / 2 + (i / steps) * Math.PI;
        profile.push([i === 0 || i === steps ? 0 : radius * Math.cos(angle), radius * Math.sin(angle)]);
    }
    const mesh = kit.lathe(profile, slot, segments);
    mesh.position.set(...center);
    return mesh;
}

/**
 * Narrows the back (−Z) half of a box mesh made by `kit.box` (without bevel) vertically to `factor` of its height,
 * keeping the top edge in place, so its side section becomes a trapezoid.
 */
export function taperBack(mesh: THREE.Mesh, factor: number): THREE.Mesh {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const top = box.max.y;
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
        if (position.getZ(i) < (box.min.z + box.max.z) / 2) {
            position.setY(i, top - (top - position.getY(i)) * factor);
        }
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return mesh;
}

/**
 * Wraps `root` so the bounding box of its geometry is horizontally centered on the origin with its lowest point at
 * y = 0 (the base-point rule), and returns the wrapper.
 */
export function centerOnBase(kit: BuilderKit, root: THREE.Object3D, name: string): THREE.Group {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true);
    const center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    return kit.group(name, root);
}
