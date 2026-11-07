import { Euler, Matrix4, Quaternion, Vector3, MathUtils } from "three";

import type { SceneObject, SceneState, Vec3 } from "./types";

export interface LocalTransform {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
}

type SceneObjects = Pick<SceneState, "objects">;
type SceneWithOrder = Pick<SceneState, "objects" | "rootOrder">;

export const MIN_SCALE = 0.01;

function normalizeAngle(deg: number): number {
    // result in (-180, 180]
    let a = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (a === -180) {
        a = 180;
    }
    return a;
}

/** removes floating point noise from matrix decomposition */
function round(v: number): number {
    const r = Math.round(v * 1e6) / 1e6;
    return r === 0 ? 0 : r;
}

export function toMatrix(obj: Pick<SceneObject, "position" | "rotation" | "scale">, target = new Matrix4()): Matrix4 {
    const euler = new Euler(MathUtils.degToRad(obj.rotation[0]), MathUtils.degToRad(obj.rotation[1]), MathUtils.degToRad(obj.rotation[2]), "XYZ");
    const quat = new Quaternion().setFromEuler(euler);
    return target.compose(new Vector3(...obj.position), quat, new Vector3(...obj.scale));
}

export function fromMatrix(matrix: Matrix4): LocalTransform {
    const position = new Vector3();
    const quat = new Quaternion();
    const scale = new Vector3();
    matrix.decompose(position, quat, scale);
    const euler = new Euler().setFromQuaternion(quat, "XYZ");
    return {
        position: [round(position.x), round(position.y), round(position.z)],
        rotation: [
            round(normalizeAngle(MathUtils.radToDeg(euler.x))),
            round(normalizeAngle(MathUtils.radToDeg(euler.y))),
            round(normalizeAngle(MathUtils.radToDeg(euler.z))),
        ],
        scale: [
            Math.max(MIN_SCALE, round(Math.abs(scale.x))),
            Math.max(MIN_SCALE, round(Math.abs(scale.y))),
            Math.max(MIN_SCALE, round(Math.abs(scale.z))),
        ],
    };
}

export function getWorldMatrix(scene: SceneObjects, id: string): Matrix4 {
    const chain: SceneObject[] = [];
    const seen = new Set<string>();
    let current: SceneObject | undefined = scene.objects[id];
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.push(current);
        current = current.parentId ? scene.objects[current.parentId] : undefined;
    }
    const result = new Matrix4();
    const local = new Matrix4();
    for (let i = chain.length - 1; i >= 0; i--) {
        result.multiply(toMatrix(chain[i], local));
    }
    return result;
}

/** World matrix of `parentId`, identity for null. */
export function getParentWorldMatrix(scene: SceneObjects, parentId: string | null): Matrix4 {
    return parentId ? getWorldMatrix(scene, parentId) : new Matrix4();
}

export function worldToLocal(scene: SceneObjects, parentId: string | null, world: Matrix4): LocalTransform {
    const parentWorld = getParentWorldMatrix(scene, parentId);
    return fromMatrix(parentWorld.invert().multiply(world));
}

/** FR-033: local = inverse(parentWorld_new) x world */
export function reparentKeepingWorld(scene: SceneObjects, id: string, newParentId: string | null): LocalTransform {
    return worldToLocal(scene, newParentId, getWorldMatrix(scene, id));
}

export function wouldCreateCycle(scene: SceneObjects, id: string, newParentId: string | null): boolean {
    let current = newParentId;
    const seen = new Set<string>();
    while (current) {
        if (current === id || seen.has(current)) {
            return true;
        }
        seen.add(current);
        current = scene.objects[current]?.parentId ?? null;
    }
    return false;
}

export function getDescendantIds(scene: SceneObjects, id: string): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    const stack = [...(scene.objects[id]?.children ?? [])];
    while (stack.length > 0) {
        const next = stack.pop()!;
        const obj = scene.objects[next];
        if (!obj || seen.has(next)) {
            continue;
        }
        seen.add(next);
        result.push(next);
        stack.push(...obj.children);
    }
    return result;
}

/** Selected ids whose ancestors are not selected (research R7). */
export function getSelectionRoots(scene: SceneObjects, ids: string[]): string[] {
    const set = new Set(ids);
    return ids.filter((id) => {
        let parent = scene.objects[id]?.parentId ?? null;
        while (parent) {
            if (set.has(parent)) {
                return false;
            }
            parent = scene.objects[parent]?.parentId ?? null;
        }
        return true;
    });
}

/** Own `visible` AND all ancestors visible. Lock is not inherited. */
export function isEffectivelyVisible(scene: SceneObjects, id: string): boolean {
    let current: SceneObject | undefined = scene.objects[id];
    const seen = new Set<string>();
    while (current) {
        if (!current.visible || seen.has(current.id)) {
            return false;
        }
        seen.add(current.id);
        current = current.parentId ? scene.objects[current.parentId] : undefined;
    }
    return true;
}

/** Children list of `parentId` (root order for null). */
export function getSiblings(scene: SceneWithOrder, parentId: string | null): string[] {
    return parentId ? scene.objects[parentId]?.children ?? [] : scene.rootOrder;
}

export type Axis = "x" | "y" | "z";
const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

function worldPosition(scene: SceneObjects, id: string): Vector3 {
    return new Vector3().setFromMatrixPosition(getWorldMatrix(scene, id));
}

function withWorldPosition(scene: SceneObjects, id: string, pos: Vector3): LocalTransform {
    const world = getWorldMatrix(scene, id);
    const p = new Vector3();
    const q = new Quaternion();
    const s = new Vector3();
    world.decompose(p, q, s);
    const newWorld = new Matrix4().compose(pos, q, s);
    return worldToLocal(scene, scene.objects[id].parentId, newWorld);
}

/** New local transforms so every object's world position on `axis` equals the active object's. */
export function alignToActive(scene: SceneObjects, ids: string[], activeId: string, axis: Axis): Record<string, LocalTransform> {
    const result: Record<string, LocalTransform> = {};
    const i = AXIS_INDEX[axis];
    const target = worldPosition(scene, activeId).getComponent(i);
    for (const id of ids) {
        if (id === activeId) {
            continue;
        }
        const pos = worldPosition(scene, id);
        pos.setComponent(i, target);
        result[id] = withWorldPosition(scene, id, pos);
    }
    return result;
}

/** Keeps the outermost two objects, spaces the others equally between them in world space. Needs >= 3 ids. */
export function distributeEvenly(scene: SceneObjects, ids: string[], axis: Axis): Record<string, LocalTransform> {
    const result: Record<string, LocalTransform> = {};
    if (ids.length < 3) {
        return result;
    }
    const i = AXIS_INDEX[axis];
    const entries = ids.map((id) => ({ id, pos: worldPosition(scene, id) })).sort((a, b) => a.pos.getComponent(i) - b.pos.getComponent(i));
    const first = entries[0].pos.getComponent(i);
    const last = entries[entries.length - 1].pos.getComponent(i);
    const step = (last - first) / (entries.length - 1);
    for (let n = 1; n < entries.length - 1; n++) {
        const pos = entries[n].pos.clone();
        pos.setComponent(i, first + step * n);
        result[entries[n].id] = withWorldPosition(scene, entries[n].id, pos);
    }
    return result;
}
