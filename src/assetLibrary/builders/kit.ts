/**
 * BuilderKit implementation for procedural and parametric asset builders (feature 002, contracts/asset-catalog.ts).
 * Meshes carry `userData.slot` and a placeholder material; the asset cache replaces the materials later.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BuilderKit, MaterialSlot, Vec3 } from "../types";

const UP = new THREE.Vector3(0, 1, 0);

function slotMesh(geometry: THREE.BufferGeometry, slot: MaterialSlot): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x888888 }));
    mesh.userData.slot = slot;
    return mesh;
}

function roundedRect(width: number, depth: number, radius: number): THREE.Shape {
    const w = width / 2;
    const d = depth / 2;
    const r = Math.min(radius, w - 1e-4, d - 1e-4);
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -d);
    shape.lineTo(w - r, -d);
    shape.quadraticCurveTo(w, -d, w, -d + r);
    shape.lineTo(w, d - r);
    shape.quadraticCurveTo(w, d, w - r, d);
    shape.lineTo(-w + r, d);
    shape.quadraticCurveTo(-w, d, -w, d - r);
    shape.lineTo(-w, -d + r);
    shape.quadraticCurveTo(-w, -d, -w + r, -d);
    return shape;
}

/** Keeps only position, normal and uv, drops groups, so geometries from different primitives can be merged. */
function normalizeAttributes(geometry: THREE.BufferGeometry) {
    for (const name of Object.keys(geometry.attributes)) {
        if (name !== "position" && name !== "normal" && name !== "uv") {
            geometry.deleteAttribute(name);
        }
    }
    if (!geometry.getAttribute("normal")) {
        geometry.computeVertexNormals();
    }
    if (!geometry.getAttribute("uv")) {
        const count = geometry.getAttribute("position").count;
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    geometry.clearGroups();
    geometry.morphAttributes = {} as THREE.BufferGeometry["morphAttributes"];
}

function mergeSlotGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    if (geometries.length === 1) {
        return geometries[0];
    }
    const indexed = geometries.every((g) => g.index !== null);
    const parts = indexed ? geometries : geometries.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(parts, false);
    for (const g of new Set([...geometries, ...parts])) {
        g.dispose();
    }
    if (!merged) {
        throw new Error("mergeBySlot: geometries could not be merged");
    }
    return merged;
}

function disposeMeshMaterial(mesh: THREE.Mesh) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of materials) {
        m.dispose();
    }
}

/**
 * Merges the meshes below `node` per slot into the frame of `node`. Descent stops at nodes whose name is in `keep`;
 * those are merged recursively and attached with their transform relative to `node`.
 */
function mergeNode(node: THREE.Object3D, keep: ReadonlySet<string>): THREE.Group {
    const result = new THREE.Group();
    result.name = node.name;
    result.userData = { ...node.userData };
    delete result.userData.slot;

    const inverse = node.matrixWorld.clone().invert();
    const bySlot = new Map<string, THREE.BufferGeometry[]>();
    const keptChildren: THREE.Object3D[] = [];

    const visit = (obj: THREE.Object3D) => {
        for (const child of obj.children) {
            if (child.name && keep.has(child.name)) {
                keptChildren.push(child);
                continue;
            }
            if (child instanceof THREE.Mesh) {
                const slot: string = child.userData.slot ?? "body";
                const geometry = (child.geometry as THREE.BufferGeometry).clone();
                geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld));
                normalizeAttributes(geometry);
                let list = bySlot.get(slot);
                if (!list) {
                    list = [];
                    bySlot.set(slot, list);
                }
                list.push(geometry);
                child.geometry.dispose();
                disposeMeshMaterial(child);
            }
            visit(child);
        }
    };
    visit(node);

    for (const [slot, geometries] of bySlot) {
        const mesh = slotMesh(mergeSlotGeometries(geometries), slot);
        mesh.name = `slot:${slot}`;
        result.add(mesh);
    }

    for (const kept of keptChildren) {
        const merged = mergeNode(kept, keep);
        const local = new THREE.Matrix4().multiplyMatrices(inverse, kept.matrixWorld);
        local.decompose(merged.position, merged.quaternion, merged.scale);
        result.add(merged);
    }
    return result;
}

export function createBuilderKit(): BuilderKit {
    return {
        box(size: Vec3, slot: MaterialSlot, opts?: { bevel?: number }): THREE.Mesh {
            const [w, h, d] = size;
            const bevel = opts?.bevel ?? 0;
            let geometry: THREE.BufferGeometry;
            if (bevel > 0) {
                geometry = new THREE.ExtrudeGeometry(roundedRect(w, d, bevel), { depth: h, bevelEnabled: false, curveSegments: 4 });
                // extrusion runs along +Z from 0 to h; rotate so it runs along +Y (shape y becomes -z)
                geometry.rotateX(-Math.PI / 2);
            } else {
                geometry = new THREE.BoxGeometry(w, h, d);
                geometry.translate(0, h / 2, 0);
            }
            return slotMesh(geometry, slot);
        },

        cylinder(radiusTop: number, radiusBottom: number, height: number, slot: MaterialSlot, segments = 16): THREE.Mesh {
            const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
            geometry.translate(0, height / 2, 0);
            return slotMesh(geometry, slot);
        },

        tube(from: Vec3, to: Vec3, radius: number, slot: MaterialSlot): THREE.Mesh {
            const a = new THREE.Vector3(...from);
            const b = new THREE.Vector3(...to);
            const dir = b.clone().sub(a);
            const length = dir.length();
            const mesh = slotMesh(new THREE.CylinderGeometry(radius, radius, Math.max(length, 1e-6), 12), slot);
            if (length > 0) {
                mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
            }
            mesh.position.copy(a).add(b).multiplyScalar(0.5);
            return mesh;
        },

        lathe(profile: Array<[number, number]>, slot: MaterialSlot, segments = 24): THREE.Mesh {
            const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
            return slotMesh(new THREE.LatheGeometry(points, segments), slot);
        },

        group(name: string, ...children: THREE.Object3D[]): THREE.Group {
            const g = new THREE.Group();
            g.name = name;
            if (children.length > 0) {
                g.add(...children);
            }
            return g;
        },

        mergeBySlot(root: THREE.Object3D, keep: string[] = []): THREE.Object3D {
            root.updateMatrixWorld(true);
            const merged = mergeNode(root, new Set(keep));
            merged.position.copy(root.position);
            merged.quaternion.copy(root.quaternion);
            merged.scale.copy(root.scale);
            return merged;
        },
    };
}

/** Shared stateless kit instance. */
export const builderKit: BuilderKit = createBuilderKit();
