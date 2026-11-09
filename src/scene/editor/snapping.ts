/**
 * Mounting and connection snapping (feature 002, US5, research R8, contracts/library-ui.md → Snapping).
 * Works in world space on the mounting descriptors of the library assets in the scene: fixtures hang under or stand
 * on truss chords and stand on platform tops, truss elements connect end to end.
 */
import * as THREE from "three";

import { assetCatalog, mountingOf, type AssetDefinition, type FixtureAssetDefinition, type MountMode, type ParamValues } from "@/assetLibrary";
import { EDITOR_LAYER } from "@/visualization/sceneView";
import { fromMatrix, getWorldMatrix, isEffectivelyVisible } from "../model/transformMath";
import { isLibraryAsset, type SceneState, type Vec3 } from "../model/types";

/** Capture distance of mounting areas and connection points (m). */
export const SNAP_DISTANCE = 0.3;
/** A connection point is occupied if a compatible point of another object lies within this distance (m). */
const OCCUPIED_DISTANCE = 0.01;

export type SnapKind = "hang" | "stand" | "connect";

export type SnapHighlight =
    | { type: "line"; start: Vec3; end: Vec3; radius: number }
    | { type: "rect"; center: Vec3; size: [number, number]; quaternion: [number, number, number, number] }
    | { type: "point"; position: Vec3 };

export interface SnapResult {
    kind: SnapKind;
    targetId: string;
    /** World position of the snapped object's origin. */
    position: Vec3;
    /** World rotation, Euler XYZ in degrees. */
    rotation: Vec3;
    highlight: SnapHighlight;
    /** Status hint: "Hang on <name>", "Stand on <name>" or "Connect to <name>". */
    label: string;
}

interface LineTarget {
    objectId: string;
    name: string;
    start: THREE.Vector3;
    end: THREE.Vector3;
    radius: number;
    modes: MountMode[];
    /** The asset's world up, used to tell above from below. */
    up: THREE.Vector3;
}

interface SurfaceTarget {
    objectId: string;
    name: string;
    center: THREE.Vector3;
    normal: THREE.Vector3;
    axisU: THREE.Vector3;
    axisV: THREE.Vector3;
    halfU: number;
    halfV: number;
}

interface ConnectionTarget {
    objectId: string;
    name: string;
    position: THREE.Vector3;
    direction: THREE.Vector3;
    up: THREE.Vector3;
    type: string;
    free: boolean;
}

export interface SnapTargets {
    lines: LineTarget[];
    surfaces: SurfaceTarget[];
    connections: ConnectionTarget[];
}

export interface SnapOptions {
    /** Objects that are no targets (the dragged object and its descendants). */
    exclude?: Iterable<string>;
    /** Pointer ray of a library drag: a target close to the ray is captured too. */
    ray?: THREE.Ray;
    /** Current world rotation of the dragged object; snapping keeps the closest yaw. */
    currentQuaternion?: THREE.Quaternion;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function vec(v: Vec3): THREE.Vector3 {
    return new THREE.Vector3(v[0], v[1], v[2]);
}

function toVec3(v: THREE.Vector3): Vec3 {
    return [v.x, v.y, v.z];
}

/** Whether `id` is a stage truss element (`stage.truss-*`) that connects end to end. */
export function isTrussAsset(assetId: string): boolean {
    return assetId.startsWith("stage.truss-");
}

/** World position and Euler XYZ rotation (degrees) of a rotation basis at `position`. */
function poseFromBasis(position: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3): { position: Vec3; rotation: Vec3 } {
    const matrix = new THREE.Matrix4().makeBasis(x, y, z).setPosition(position);
    const t = fromMatrix(matrix);
    return { position: toVec3(position), rotation: t.rotation };
}

export class SnapResolver {
    private cache: { key: string; scene: SceneState; targets: SnapTargets } | null = null;

    /**
     * @param getScene the current (raw) scene state
     * @param getVersion the history version; targets are cached per version
     */
    public constructor(private readonly getScene: () => SceneState, private readonly getVersion: () => number) {}

    /**
     * World-space mounting areas and connection points of all visible, unlocked library assets except `excludeIds`.
     * Cached per history version (previews of excluded objects do not change the result).
     */
    public collectTargets(scene: SceneState, excludeIds: Iterable<string> = []): SnapTargets {
        const exclude = new Set(excludeIds);
        const key = `${this.getVersion()}|${[...exclude].sort().join(",")}`;
        if (this.cache && this.cache.key === key && this.cache.scene === scene) {
            return this.cache.targets;
        }
        const targets: SnapTargets = { lines: [], surfaces: [], connections: [] };
        for (const obj of Object.values(scene.objects)) {
            if (exclude.has(obj.id) || obj.locked || !isLibraryAsset(obj) || !isEffectivelyVisible(scene, obj.id)) {
                continue;
            }
            const definition = assetCatalog.get(obj.assetId);
            if (!definition) {
                continue;
            }
            const { areas, connections } = mountingOf(definition, obj.params);
            if (areas.length === 0 && connections.length === 0) {
                continue;
            }
            const world = getWorldMatrix(scene, obj.id);
            const up = Y_AXIS.clone().transformDirection(world);
            const scale = world.getMaxScaleOnAxis();
            for (const area of areas) {
                if (area.type === "line") {
                    targets.lines.push({
                        objectId: obj.id,
                        name: obj.name,
                        start: vec(area.start).applyMatrix4(world),
                        end: vec(area.end).applyMatrix4(world),
                        radius: area.radius * scale,
                        modes: area.modes,
                        up,
                    });
                } else {
                    // tangent axes of the rectangle: local X and Z turned from +Y onto the area normal
                    const normal = vec(area.normal).normalize();
                    const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, normal);
                    const u = X_AXIS.clone().applyQuaternion(q).transformDirection(world);
                    const v = Z_AXIS.clone().applyQuaternion(q).transformDirection(world);
                    const uLength = X_AXIS.clone().applyQuaternion(q).multiplyScalar(area.size[0] / 2);
                    const vLength = Z_AXIS.clone().applyQuaternion(q).multiplyScalar(area.size[1] / 2);
                    const linear = new THREE.Matrix3().setFromMatrix4(world);
                    targets.surfaces.push({
                        objectId: obj.id,
                        name: obj.name,
                        center: vec(area.center).applyMatrix4(world),
                        normal: normal.clone().transformDirection(world),
                        axisU: u,
                        axisV: v,
                        halfU: uLength.applyMatrix3(linear).length(),
                        halfV: vLength.applyMatrix3(linear).length(),
                    });
                }
            }
            for (const c of connections) {
                targets.connections.push({
                    objectId: obj.id,
                    name: obj.name,
                    position: vec(c.position).applyMatrix4(world),
                    direction: vec(c.direction).transformDirection(world),
                    up: vec(c.up).transformDirection(world),
                    type: c.type,
                    free: true,
                });
            }
        }
        // a point is free if no compatible point of another object lies within 1 cm
        for (const a of targets.connections) {
            a.free = !targets.connections.some(
                (b) => b !== a && b.objectId !== a.objectId && b.type === a.type && b.position.distanceTo(a.position) <= OCCUPIED_DISTANCE
            );
        }
        this.cache = { key, scene, targets };
        return targets;
    }

    /**
     * Snaps a fixture whose mounting point is at (or near) `pointerPoint`. `scale` is the fixture's total uniform
     * scale (model scale × object scale), used for the mounting point offset.
     */
    public resolveFixture(def: FixtureAssetDefinition, scale: number, pointerPoint: THREE.Vector3, options: SnapOptions = {}): SnapResult | null {
        const targets = this.collectTargets(this.getScene(), options.exclude);
        const mount = def.fixture.mountingPoints[0];
        const mountOffset = mount ? vec(mount.position).multiplyScalar(scale) : new THREE.Vector3();
        const currentX = X_AXIS.clone().applyQuaternion(options.currentQuaternion ?? new THREE.Quaternion());

        let best: { distance: number; result: SnapResult } | null = null;
        const offer = (distance: number, result: SnapResult) => {
            if (distance <= SNAP_DISTANCE && (!best || distance < best.distance)) {
                best = { distance, result };
            }
        };

        for (const line of targets.lines) {
            const segment = line.end.clone().sub(line.start);
            const length = segment.length();
            if (length < 1e-6) {
                continue;
            }
            const direction = segment.clone().divideScalar(length);
            const up = line.up.clone().addScaledVector(direction, -line.up.dot(direction));
            if (up.lengthSq() < 1e-8) {
                continue; // vertical chord: no defined above/below
            }
            up.normalize();

            // the pointer, or the point of the pointer ray closest to the chord
            const closest = new THREE.Line3(line.start, line.end).closestPointToPoint(pointerPoint, true, new THREE.Vector3());
            let pointer = pointerPoint;
            let chordPoint = closest;
            let distance = pointer.distanceTo(closest);
            if (options.ray) {
                const onRay = new THREE.Vector3();
                const onSegment = new THREE.Vector3();
                const rayDistance = Math.sqrt(options.ray.distanceSqToSegment(line.start, line.end, onRay, onSegment));
                if (rayDistance < distance) {
                    pointer = onRay;
                    chordPoint = onSegment;
                    distance = rayDistance;
                }
            }
            if (distance > SNAP_DISTANCE) {
                continue;
            }

            // hang below the chord's center, otherwise stand; a chord that allows only one mode uses it
            const below = pointer.clone().sub(chordPoint).dot(up) <= 1e-3;
            let mode: MountMode | null = below && line.modes.includes("hang") ? "hang" : line.modes.includes("stand") ? "stand" : null;
            mode ??= line.modes.includes("hang") ? "hang" : null;
            if (!mode) {
                continue;
            }

            // local X follows the chord, in the direction closest to the current yaw
            const x = currentX.dot(direction) >= 0 ? direction.clone() : direction.clone().negate();
            const y = mode === "hang" ? up.clone().negate() : up.clone();
            const z = new THREE.Vector3().crossVectors(x, y);
            const mountPoint = chordPoint.clone().addScaledVector(up, mode === "hang" ? -line.radius : line.radius);
            const rotation = new THREE.Matrix4().makeBasis(x, y, z);
            const origin = mountPoint.clone().sub(mountOffset.clone().applyMatrix4(rotation));
            offer(distance, {
                kind: mode,
                targetId: line.objectId,
                ...poseFromBasis(origin, x, y, z),
                highlight: { type: "line", start: toVec3(line.start), end: toVec3(line.end), radius: line.radius },
                label: `${mode === "hang" ? "Hang on" : "Stand on"} ${line.name}`,
            });
        }

        for (const surface of targets.surfaces) {
            const rel = pointerPoint.clone().sub(surface.center);
            const height = rel.dot(surface.normal);
            const a = rel.dot(surface.axisU);
            const b = rel.dot(surface.axisV);
            if (Math.abs(height) > SNAP_DISTANCE || Math.abs(a) > surface.halfU + SNAP_DISTANCE || Math.abs(b) > surface.halfV + SNAP_DISTANCE) {
                continue;
            }
            const ca = THREE.MathUtils.clamp(a, -surface.halfU, surface.halfU);
            const cb = THREE.MathUtils.clamp(b, -surface.halfV, surface.halfV);
            const point = surface.center.clone().addScaledVector(surface.axisU, ca).addScaledVector(surface.axisV, cb);
            const distance = Math.hypot(height, a - ca, b - cb);

            // upright on the surface, keeping the current yaw
            const y = surface.normal.clone();
            const x = currentX.clone().addScaledVector(y, -currentX.dot(y));
            if (x.lengthSq() < 1e-8) {
                x.copy(surface.axisU);
            }
            x.normalize();
            const z = new THREE.Vector3().crossVectors(x, y);
            const rotation = new THREE.Matrix4().makeBasis(x, y, z);
            const origin = point.clone().sub(mountOffset.clone().applyMatrix4(rotation));
            const rectRotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(surface.axisU, surface.normal, surface.axisV));
            offer(distance, {
                kind: "stand",
                targetId: surface.objectId,
                ...poseFromBasis(origin, x, y, z),
                highlight: {
                    type: "rect",
                    center: toVec3(surface.center),
                    size: [surface.halfU * 2, surface.halfV * 2],
                    quaternion: [rectRotation.x, rectRotation.y, rectRotation.z, rectRotation.w],
                },
                label: `Stand on ${surface.name}`,
            });
        }

        return (best as { distance: number; result: SnapResult } | null)?.result ?? null;
    }

    /**
     * Connects a truss element at `dragTransform` (its world matrix while dragged) to the nearest free, compatible
     * connection point of another object within 0.3 m of one of its own connection points.
     */
    public resolveTruss(def: AssetDefinition, params: ParamValues, dragTransform: THREE.Matrix4, options: SnapOptions = {}): SnapResult | null {
        const own = mountingOf(def, params).connections.map((c) => ({
            position: vec(c.position).applyMatrix4(dragTransform),
            direction: vec(c.direction).transformDirection(dragTransform),
            up: vec(c.up).transformDirection(dragTransform),
            type: c.type,
        }));
        if (own.length === 0) {
            return null;
        }
        const targets = this.collectTargets(this.getScene(), options.exclude);

        let best: { distance: number; own: (typeof own)[number]; target: ConnectionTarget } | null = null;
        for (const target of targets.connections) {
            if (!target.free) {
                continue;
            }
            const compatible = own.filter((o) => o.type === target.type);
            if (compatible.length === 0) {
                continue;
            }
            for (const o of compatible) {
                const distance = o.position.distanceTo(target.position);
                if (distance <= SNAP_DISTANCE && (!best || distance < best.distance)) {
                    best = { distance, own: o, target };
                }
            }
            // library drag: pointing at a free point captures it, so elevated truss is reachable; the own point that
            // needs the least rotation connects
            const rayDistance = options.ray?.distanceToPoint(target.position) ?? Infinity;
            if (rayDistance <= SNAP_DISTANCE && (!best || rayDistance < best.distance)) {
                const facing = target.direction.clone().negate();
                const own = compatible.reduce((a, b) => (b.direction.dot(facing) > a.direction.dot(facing) + 1e-6 ? b : a));
                best = { distance: rayDistance, own, target };
            }
        }
        if (!best) {
            return null;
        }

        // rotation: own direction → opposite of the target direction, own up → target up
        const { own: o, target: t } = best;
        const ownBasis = basis(o.direction, o.up);
        const targetBasis = basis(t.direction.clone().negate(), t.up);
        if (!ownBasis || !targetBasis) {
            return null;
        }
        const rotation = targetBasis.multiply(ownBasis.transpose());
        const world = new THREE.Matrix4()
            .makeTranslation(t.position.x, t.position.y, t.position.z)
            .multiply(rotation)
            .multiply(new THREE.Matrix4().makeTranslation(-o.position.x, -o.position.y, -o.position.z))
            .multiply(dragTransform);
        const pose = fromMatrix(world);
        return {
            kind: "connect",
            targetId: t.objectId,
            position: pose.position,
            rotation: pose.rotation,
            highlight: { type: "point", position: toVec3(t.position) },
            label: `Connect to ${t.name}`,
        };
    }
}

/** Orthonormal rotation matrix with columns (direction, up, direction × up); null if degenerate. */
function basis(direction: THREE.Vector3, up: THREE.Vector3): THREE.Matrix4 | null {
    const x = direction.clone().normalize();
    const y = up.clone().addScaledVector(x, -up.dot(x));
    if (y.lengthSq() < 1e-8) {
        return null;
    }
    y.normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    return new THREE.Matrix4().makeBasis(x, y, z);
}

// ---------------------------------------------------------------------------------------------------------------
// Highlight on the editor layer
// ---------------------------------------------------------------------------------------------------------------

const HIGHLIGHT_COLOR = 0x00e5ff;

/** The candidate's area or point: a thick line along a chord, a rectangle outline or a small sphere. */
export class SnapHighlightView {
    private readonly root = new THREE.Group();
    private readonly material = new THREE.MeshBasicMaterial({ color: HIGHLIGHT_COLOR, depthTest: false, transparent: true, opacity: 0.85 });
    private readonly lineMaterial = new THREE.LineBasicMaterial({ color: HIGHLIGHT_COLOR, depthTest: false, transparent: true, opacity: 0.95 });
    private readonly cylinder: THREE.Mesh;
    private readonly sphere: THREE.Mesh;
    private readonly rect: THREE.LineLoop;

    public constructor(scene: THREE.Scene) {
        // unit shapes, scaled per highlight
        this.cylinder = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), this.material);
        this.sphere = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), this.material);
        this.rect = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-0.5, 0, -0.5),
                new THREE.Vector3(0.5, 0, -0.5),
                new THREE.Vector3(0.5, 0, 0.5),
                new THREE.Vector3(-0.5, 0, 0.5),
            ]),
            this.lineMaterial
        );
        this.root.name = "snap-highlight";
        this.root.add(this.cylinder, this.sphere, this.rect);
        this.root.traverse((o) => {
            o.layers.set(EDITOR_LAYER);
            o.userData.editorHelper = true;
            o.renderOrder = 20;
            o.raycast = () => undefined;
        });
        this.root.visible = false;
        scene.add(this.root);
    }

    public show(highlight: SnapHighlight | null) {
        this.root.visible = highlight !== null;
        if (!highlight) {
            return;
        }
        this.cylinder.visible = highlight.type === "line";
        this.sphere.visible = highlight.type === "point";
        this.rect.visible = highlight.type === "rect";
        if (highlight.type === "line") {
            const start = vec(highlight.start);
            const end = vec(highlight.end);
            const axis = end.clone().sub(start);
            const radius = Math.max(highlight.radius * 1.5, 0.02);
            this.cylinder.position.copy(start).add(end).multiplyScalar(0.5);
            this.cylinder.quaternion.setFromUnitVectors(Y_AXIS, axis.clone().normalize());
            this.cylinder.scale.set(radius, Math.max(axis.length(), 1e-3), radius);
        } else if (highlight.type === "point") {
            this.sphere.position.set(...highlight.position);
        } else {
            this.rect.position.set(...highlight.center);
            this.rect.quaternion.set(...highlight.quaternion);
            // slightly above the surface, so the outline is not hidden in it
            this.rect.position.add(Y_AXIS.clone().applyQuaternion(this.rect.quaternion).multiplyScalar(0.005));
            this.rect.scale.set(highlight.size[0], 1, highlight.size[1]);
        }
    }

    public dispose() {
        this.root.removeFromParent();
        this.cylinder.geometry.dispose();
        this.sphere.geometry.dispose();
        this.rect.geometry.dispose();
        this.material.dispose();
        this.lineMaterial.dispose();
    }
}
