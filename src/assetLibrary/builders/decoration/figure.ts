/**
 * decoration.figure-standing / decoration.figure-arms-up: a stylized mannequin (capsule limbs, sphere head) facing +Z
 * (feature 002). Standing: 1.78 m tall, arms down. Arms up: both arms raised, 2.15 m to the hands. Slot: `body`.
 */
import type * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";
import { capsule, centerOnBase, sphere } from "./shapes";

const SEGMENTS = 10;

/** Arm joints of one side (x > 0); the other side is mirrored. */
interface ArmPose {
    elbow: Vec3;
    wrist: Vec3;
    hand: Vec3;
}

const SHOULDER: Vec3 = [0.19, 1.43, 0];

const ARMS_DOWN: ArmPose = {
    elbow: [0.215, 1.14, -0.01],
    wrist: [0.225, 0.88, 0.02],
    hand: [0.225, 0.79, 0.03],
};

const ARMS_UP: ArmPose = {
    elbow: [0.25, 1.72, 0],
    wrist: [0.275, 1.98, 0.01],
    hand: [0.28, 2.11, 0.015],
};

function mirror([x, y, z]: Vec3, side: number): Vec3 {
    return [x * side, y, z];
}

function buildFigure(kit: BuilderKit, name: string, arms: ArmPose): THREE.Object3D {
    const root = kit.group(name);

    // head and neck
    const head = sphere(kit, [0, 1.665, 0.01], 0.1, "body", 14);
    head.scale.set(0.9, 1.15, 1);
    root.add(head);
    root.add(capsule(kit, [0, 1.47, 0], [0, 1.54, 0.005], 0.045, "body", SEGMENTS));

    // torso and pelvis, flattened front to back
    const torso = capsule(kit, [0, 1.13, 0], [0, 1.36, 0], 0.15, "body", 14);
    torso.scale.set(1.1, 1, 0.62);
    root.add(torso);
    const pelvis = capsule(kit, [0, 0.93, 0], [0, 1.0, 0], 0.13, "body", 14);
    pelvis.scale.set(1.05, 1, 0.7);
    root.add(pelvis);
    // shoulder bar connects the arms to the torso
    root.add(capsule(kit, mirror(SHOULDER, -1), SHOULDER, 0.055, "body", SEGMENTS));

    for (const side of [-1, 1]) {
        // legs: hip, knee, ankle, plus a foot pointing forward
        const hip: Vec3 = [0.09 * side, 0.92, 0];
        const knee: Vec3 = [0.095 * side, 0.5, 0.01];
        const ankle: Vec3 = [0.1 * side, 0.09, -0.01];
        root.add(capsule(kit, hip, knee, 0.068, "body", SEGMENTS));
        root.add(capsule(kit, knee, ankle, 0.052, "body", SEGMENTS));
        const foot = kit.box([0.09, 0.07, 0.24], "body", { bevel: 0.03 });
        foot.position.set(0.1 * side, 0, 0.05);
        root.add(foot);

        // arms
        root.add(capsule(kit, mirror(SHOULDER, side), mirror(arms.elbow, side), 0.045, "body", SEGMENTS));
        root.add(capsule(kit, mirror(arms.elbow, side), mirror(arms.wrist, side), 0.038, "body", SEGMENTS));
        root.add(capsule(kit, mirror(arms.wrist, side), mirror(arms.hand, side), 0.04, "body", SEGMENTS));
    }

    return kit.mergeBySlot(centerOnBase(kit, root, `${name}-base`));
}

export function buildFigureStanding(kit: BuilderKit): THREE.Object3D {
    return buildFigure(kit, "figure-standing", ARMS_DOWN);
}

export function buildFigureArmsUp(kit: BuilderKit): THREE.Object3D {
    return buildFigure(kit, "figure-arms-up", ARMS_UP);
}
