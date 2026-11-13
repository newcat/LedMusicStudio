/**
 * Runtime of the fixture model contract (feature 002, research R7). Turns an asset template and its
 * FixtureModelDescription into a body with pan/tilt nodes, a beam anchor and emitter meshes.
 * Renderers only use this API, so adding a model never touches renderer code (SC-006).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import { NO_SHADOW_LAYER } from "@/visualization/layers";
import { instantiate } from "./assetCache";
import type { Axis, Emitter, FixtureAssetDefinition, MovingPart, Vec3 } from "./types";

/** Above this number of emitters, "all" updates go to one merged vertex-colored mesh per node. */
export const EMITTER_MERGE_THRESHOLD = 8;

const AXIS_VECTORS: Record<Axis, THREE.Vector3> = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
};
const PLUS_Z = new THREE.Vector3(0, 0, 1);
const PLUS_Y = new THREE.Vector3(0, 1, 0);

function vec(v: Vec3): THREE.Vector3 {
    return new THREE.Vector3(v[0], v[1], v[2]);
}

/** Orientation whose +Z is `normal` and, if given, whose +Y follows `up`. */
function orientation(normal: Vec3, up?: Vec3): THREE.Quaternion {
    const z = vec(normal).normalize();
    if (!up) {
        return new THREE.Quaternion().setFromUnitVectors(PLUS_Z, z);
    }
    const y = vec(up).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    if (x.lengthSq() < 1e-8) {
        return new THREE.Quaternion().setFromUnitVectors(PLUS_Z, z);
    }
    x.normalize();
    y.crossVectors(z, x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function emitterGeometry(emitter: Emitter): THREE.BufferGeometry {
    return emitter.shape === "circle" ? new THREE.CircleGeometry(emitter.radius, 32) : new THREE.PlaneGeometry(emitter.size[0], emitter.size[1]);
}

function emitterOrientation(emitter: Emitter): THREE.Quaternion {
    return orientation(emitter.normal, emitter.shape === "rect" ? emitter.up : undefined);
}

const noRaycast = () => undefined;

interface MergedEmitters {
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    /** vertex range per emitter id */
    ranges: Map<string, { start: number; count: number }>;
}

interface MovingNode {
    node: THREE.Object3D;
    rest: THREE.Quaternion;
    axis: THREE.Vector3;
}

export class FixtureBody extends THREE.Group {
    /** The instantiated template (shares geometry and materials with it). */
    public readonly model: THREE.Object3D;
    public readonly panNode: THREE.Object3D | null;
    public readonly tiltNode: THREE.Object3D | null;
    /** Local +Z is the beam direction; beam, cap and lights hang here. */
    public readonly beamAnchor = new THREE.Object3D();
    /** Per-emitter meshes; created lazily when the body uses merged emitters. */
    public readonly emitters = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();

    private readonly scaleGroup = new THREE.Group();
    private readonly pan: MovingNode | null;
    private readonly tilt: MovingNode | null;
    private readonly emitterById = new Map<string, Emitter>();
    private readonly merged: MergedEmitters[] = [];
    private readonly quaternion1 = new THREE.Quaternion();

    public constructor(public readonly definition: FixtureAssetDefinition, template: THREE.Object3D) {
        super();
        this.name = `body:${definition.id}`;
        this.model = instantiate(template);
        this.scaleGroup.add(this.model);
        this.add(this.scaleGroup);

        const description = definition.fixture;
        this.pan = this.movingNode(description.movingParts?.pan);
        this.tilt = this.movingNode(description.movingParts?.tilt);
        this.panNode = this.pan?.node ?? null;
        this.tiltNode = this.tilt?.node ?? null;

        this.beamAnchor.name = "beamAnchor";
        if (description.beam) {
            this.beamAnchor.position.copy(vec(description.beam.position));
            this.beamAnchor.quaternion.setFromUnitVectors(PLUS_Z, vec(description.beam.direction).normalize());
            this.nodeOf(description.beam.node).add(this.beamAnchor);
        } else {
            this.beamAnchor.quaternion.setFromUnitVectors(PLUS_Z, PLUS_Y);
            this.model.add(this.beamAnchor);
        }

        for (const emitter of description.emitters) {
            this.emitterById.set(emitter.id, emitter);
        }
        if (description.emitters.length > EMITTER_MERGE_THRESHOLD) {
            this.buildMergedEmitters(description.emitters);
        } else {
            for (const emitter of description.emitters) {
                this.createEmitterMesh(emitter, false).visible = true;
            }
        }
    }

    /** Sets pan and tilt in degrees relative to the rest pose. */
    public setPanTilt(panDeg: number, tiltDeg: number) {
        this.applyRotation(this.pan, panDeg);
        this.applyRotation(this.tilt, tiltDeg);
    }

    /** Linear RGB, 0..1; values above 1 are allowed for bloom. */
    public setEmitterColor(id: string, r: number, g: number, b: number) {
        if (id === "all") {
            if (this.merged.length > 0) {
                for (const merged of this.merged) {
                    const colors = merged.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
                    for (let i = 0; i < colors.count; i++) {
                        colors.setXYZ(i, r, g, b);
                    }
                    colors.needsUpdate = true;
                }
                // individually set cells follow the common value again
                for (const mesh of this.emitters.values()) {
                    mesh.visible = false;
                }
            } else {
                for (const mesh of this.emitters.values()) {
                    mesh.material.color.setRGB(r, g, b);
                }
            }
            return;
        }
        let mesh = this.emitters.get(id);
        if (!mesh) {
            const emitter = this.emitterById.get(id);
            if (!emitter) {
                return;
            }
            mesh = this.createEmitterMesh(emitter, this.merged.length > 0);
        }
        mesh.material.color.setRGB(r, g, b);
        mesh.visible = true;
    }

    /** Uniform scale of the body (the object's own transform stays the user's). */
    public setModelScale(scale: number) {
        this.scaleGroup.scale.setScalar(scale);
    }

    /** Frees only the emitter resources; template geometry and materials stay shared. */
    public dispose() {
        for (const mesh of this.emitters.values()) {
            mesh.removeFromParent();
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        this.emitters.clear();
        for (const merged of this.merged) {
            merged.mesh.removeFromParent();
            merged.mesh.geometry.dispose();
            merged.mesh.material.dispose();
        }
        this.merged.length = 0;
    }

    private nodeOf(name: string): THREE.Object3D {
        if (name === "") {
            return this.model;
        }
        const node = this.model.getObjectByName(name);
        if (!node) {
            console.warn(`[asset-library] node "${name}" not found in "${this.definition.id}"`);
            return this.model;
        }
        return node;
    }

    private movingNode(part: MovingPart | undefined): MovingNode | null {
        if (!part) {
            return null;
        }
        const node = this.nodeOf(part.node);
        return { node, rest: node.quaternion.clone(), axis: AXIS_VECTORS[part.axis] ?? AXIS_VECTORS.y };
    }

    private applyRotation(target: MovingNode | null, deg: number) {
        if (!target) {
            return;
        }
        this.quaternion1.setFromAxisAngle(target.axis, THREE.MathUtils.degToRad(Number.isFinite(deg) ? deg : 0));
        target.node.quaternion.copy(target.rest).multiply(this.quaternion1);
    }

    private createEmitterMesh(emitter: Emitter, overMerged: boolean) {
        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            toneMapped: false,
            side: THREE.DoubleSide,
            // drawn on top of the merged emitter mesh of the same cell
            polygonOffset: overMerged,
            polygonOffsetFactor: overMerged ? -1 : 0,
            polygonOffsetUnits: overMerged ? -1 : 0,
        });
        const mesh = new THREE.Mesh(emitterGeometry(emitter), material);
        mesh.name = `emitter:${emitter.id}`;
        mesh.raycast = noRaycast;
        mesh.layers.set(NO_SHADOW_LAYER);
        mesh.position.copy(vec(emitter.position));
        mesh.quaternion.copy(emitterOrientation(emitter));
        mesh.visible = false;
        this.nodeOf(emitter.node).add(mesh);
        this.emitters.set(emitter.id, mesh);
        return mesh;
    }

    private buildMergedEmitters(emitters: Emitter[]) {
        const byNode = new Map<string, Emitter[]>();
        for (const emitter of emitters) {
            const list = byNode.get(emitter.node) ?? [];
            list.push(emitter);
            byNode.set(emitter.node, list);
        }
        const matrix = new THREE.Matrix4();
        const one = new THREE.Vector3(1, 1, 1);
        for (const [nodeName, list] of byNode) {
            const ranges = new Map<string, { start: number; count: number }>();
            const geometries: THREE.BufferGeometry[] = [];
            let start = 0;
            for (const emitter of list) {
                const geometry = emitterGeometry(emitter);
                geometry.applyMatrix4(matrix.compose(vec(emitter.position), emitterOrientation(emitter), one));
                const count = geometry.getAttribute("position").count;
                ranges.set(emitter.id, { start, count });
                start += count;
                geometries.push(geometry);
            }
            const geometry = mergeGeometries(geometries);
            geometries.forEach((g) => g.dispose());
            if (!geometry) {
                continue;
            }
            geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(start * 3), 3));
            const mesh = new THREE.Mesh(
                geometry,
                new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false, side: THREE.DoubleSide }),
            );
            mesh.name = "emitters:merged";
            mesh.raycast = noRaycast;
            mesh.layers.set(NO_SHADOW_LAYER);
            this.nodeOf(nodeName).add(mesh);
            this.merged.push({ mesh, ranges });
        }
    }
}
