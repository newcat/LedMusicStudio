/**
 * Aim targets: analytic inverse kinematics (feature 004, research R11). Pure: only three.js math, no stores.
 *
 * Forward model in the fixture model frame: the beam at rest points along `beamDirection`; pan rotates about
 * `panAxis`, then tilt rotates about `tiltAxis` (the tilt node is a child of the pan node, rest quaternions are
 * identity, see `FixtureBody.setPanTilt`). Both pan/tilt solutions are checked against the ranges; the reachable one
 * with |pan| closest to 0 (the center of the range, FR-034) wins.
 */

import { Matrix4, Quaternion, Vector3 } from "three";
import type { Vec3 } from "@/scene/model/types";
import type { Range } from "./attributes";

export interface AimResult {
    pan: number;
    tilt: number;
    /** false = target outside the pan/tilt range; values are clamped (FR-034). */
    reachable: boolean;
}

export interface AimModel {
    panAxis: Vec3;
    tiltAxis: Vec3;
    beamDirection: Vec3;
    /** Tilt pivot in the model frame (on the pan axis); the beam starts here. Default: model origin. */
    pivot?: Vec3;
    /** Optional rest rotation of the pan node (quaternion x, y, z, w) for models whose rest pose is not identity. */
    restRotation?: [number, number, number, number];
}

export const DEFAULT_AIM_MODEL: AimModel = { panAxis: [0, 1, 0], tiltAxis: [1, 0, 0], beamDirection: [0, 1, 0] };

const RAD2DEG = 180 / Math.PI;

function wrap180(deg: number): number {
    let a = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (a === -180) {
        a = 180;
    }
    return a;
}

/** Signed angle (radians) from `a` to `b` around `axis`, both projected onto the plane perpendicular to `axis`. */
function signedAngle(a: Vector3, b: Vector3, axis: Vector3): number | null {
    const pa = a.clone().addScaledVector(axis, -a.dot(axis));
    const pb = b.clone().addScaledVector(axis, -b.dot(axis));
    if (pa.lengthSq() < 1e-12 || pb.lengthSq() < 1e-12) {
        return null;
    }
    pa.normalize();
    pb.normalize();
    return Math.atan2(axis.dot(new Vector3().crossVectors(pa, pb)), pa.dot(pb));
}

function within(v: number, r: Range): boolean {
    return v >= r.min - 1e-6 && v <= r.max + 1e-6;
}

function clampTo(v: number, r: Range): number {
    return Math.min(r.max, Math.max(r.min, v));
}

/** Candidate angles: the value plus/minus full turns that fall inside (or closest to) the range. */
function unwrapInto(deg: number, r: Range): number[] {
    const result: number[] = [];
    for (let k = -2; k <= 2; k++) {
        const v = deg + 360 * k;
        if (within(v, r)) {
            result.push(v);
        }
    }
    return result.length > 0 ? result : [deg];
}

/**
 * Pan/tilt (degrees, 0 = rest) that point the beam of a fixture with world matrix `fixtureWorld` at `target`.
 * Out of range: the better solution, clamped, with `reachable: false`.
 */
export function aimAt(fixtureWorld: ArrayLike<number>, target: Vec3, model: AimModel, ranges: { pan: Range; tilt: Range }): AimResult {
    const world = new Matrix4().fromArray(Array.from(fixtureWorld));
    const inverse = world.clone().invert();
    const local = new Vector3(...target).applyMatrix4(inverse);
    if (model.pivot) {
        local.sub(new Vector3(...model.pivot));
    }
    if (model.restRotation) {
        local.applyQuaternion(new Quaternion(...model.restRotation).invert());
    }
    if (local.lengthSq() < 1e-12) {
        return { pan: 0, tilt: 0, reachable: true };
    }
    const dir = local.normalize();
    const panAxis = new Vector3(...model.panAxis).normalize();
    const tiltAxis0 = new Vector3(...model.tiltAxis).normalize();
    const beam = new Vector3(...model.beamDirection).normalize();

    // Pan turns the tilt plane so it contains the target: the target must lie in the plane spanned by the rotated
    // beam and the rotated pan axis, i.e. perpendicular to the rotated tilt axis.
    const candidates: Array<{ pan: number; tilt: number }> = [];
    // the tilt axis after pan must be perpendicular to dir: find pan so that rot(pan)·tiltAxis ⟂ dir
    // tilt axis rotated by pan: t(φ) = t∥ + cosφ·t⊥ + sinφ·(axis × t⊥)
    const tPar = panAxis.clone().multiplyScalar(tiltAxis0.dot(panAxis));
    const tPerp = tiltAxis0.clone().sub(tPar);
    const tCross = new Vector3().crossVectors(panAxis, tPerp);
    // dir·t(φ) = a + b cosφ + c sinφ = 0
    const a = dir.dot(tPar);
    const b = dir.dot(tPerp);
    const c = dir.dot(tCross);
    const rr = Math.hypot(b, c);
    if (rr < 1e-9) {
        // target along the pan axis: any pan works, keep pan at 0
        candidates.push({ pan: 0, tilt: 0 });
    } else {
        const base = Math.atan2(c, b);
        const ratio = Math.min(1, Math.max(-1, -a / rr));
        const delta = Math.acos(ratio);
        for (const phi of [base + delta, base - delta]) {
            candidates.push({ pan: phi, tilt: 0 });
        }
    }

    const solutions: Array<{ pan: number; tilt: number }> = [];
    for (const cand of candidates) {
        const qPan = new Quaternion().setFromAxisAngle(panAxis, cand.pan);
        const tiltAxis = tiltAxis0.clone().applyQuaternion(qPan);
        const beamAfterPan = beam.clone().applyQuaternion(qPan);
        const tilt = signedAngle(beamAfterPan, dir, tiltAxis);
        if (tilt === null) {
            continue;
        }
        solutions.push({ pan: wrap180(cand.pan * RAD2DEG), tilt: wrap180(tilt * RAD2DEG) });
    }
    if (solutions.length === 0) {
        return { pan: clampTo(0, ranges.pan), tilt: clampTo(0, ranges.tilt), reachable: false };
    }

    // expand by full pan turns inside the range (e.g. 540° heads) and pick the reachable one closest to center
    let best: { pan: number; tilt: number } | null = null;
    for (const s of solutions) {
        if (!within(s.tilt, ranges.tilt)) {
            continue;
        }
        for (const pan of unwrapInto(s.pan, ranges.pan)) {
            if (within(pan, ranges.pan) && (!best || Math.abs(pan) < Math.abs(best.pan))) {
                best = { pan, tilt: s.tilt };
            }
        }
    }
    if (best) {
        return { pan: best.pan, tilt: best.tilt, reachable: true };
    }
    // unreachable: clamp the solution that needs the least clamping
    let fallback = solutions[0];
    let fallbackError = Infinity;
    for (const s of solutions) {
        for (const pan of unwrapInto(s.pan, ranges.pan)) {
            const error = Math.abs(pan - clampTo(pan, ranges.pan)) + Math.abs(s.tilt - clampTo(s.tilt, ranges.tilt));
            // ties: the pan closest to the center (FR-034)
            if (error < fallbackError - 1e-9 || (Math.abs(error - fallbackError) <= 1e-9 && Math.abs(pan) < Math.abs(fallback.pan))) {
                fallbackError = error;
                fallback = { pan, tilt: s.tilt };
            }
        }
    }
    return { pan: clampTo(fallback.pan, ranges.pan), tilt: clampTo(fallback.tilt, ranges.tilt), reachable: false };
}
