/**
 * decoration.drum-kit: a five-piece drum kit, about 2.0 × 1.3 × 1.6 m (feature 002). Bass drum with its front head
 * towards +Z, snare, two rack toms, floor tom, hi-hat, crash and ride cymbals on stands, and a stool at the back (−Z),
 * where the drummer sits facing +Z.
 * Slots: `body` (shells, stool seat), `accent` (drum heads), `metal` (stands, hardware), `brass` (cymbals).
 */
import type * as THREE from "three";
import type { BuilderKit, Vec3 } from "../../types";
import { centerOnBase } from "./shapes";

const DRUM_SEGMENTS = 18;
const CYMBAL_SEGMENTS = 16;
const HEAD = 0.012;
const LEG_RADIUS = 0.009;

/** A drum along +Y from 0 to `depth`: shell plus a head (with hoop) on top and, optionally, at the bottom. */
function drum(kit: BuilderKit, name: string, radius: number, depth: number, bottomHead: boolean): THREE.Group {
    const group = kit.group(name);
    const shell = kit.cylinder(radius, radius, depth - (bottomHead ? 2 : 1) * HEAD, "body", DRUM_SEGMENTS);
    shell.position.y = bottomHead ? HEAD : 0;
    group.add(shell);
    const top = kit.cylinder(radius + 0.006, radius + 0.006, HEAD, "accent", DRUM_SEGMENTS);
    top.position.y = depth - HEAD;
    group.add(top);
    if (bottomHead) {
        group.add(kit.cylinder(radius + 0.006, radius + 0.006, HEAD, "accent", DRUM_SEGMENTS));
    }
    return group;
}

/** A cymbal of radius `radius` whose underside center is at `center`, tilted by `tilt` about X. */
function cymbal(kit: BuilderKit, center: Vec3, radius: number, tilt = 0): THREE.Mesh {
    const mesh = kit.lathe(
        [
            [0, 0.008],
            [radius, 0],
            [radius * 0.2, 0.012],
            [radius * 0.12, 0.028],
            [0, 0.028],
        ],
        "brass",
        CYMBAL_SEGMENTS,
    );
    mesh.position.set(...center);
    mesh.rotation.x = tilt;
    return mesh;
}

/** A tripod stand: three legs from the floor to `height * 0.3` on the pole, and the pole up to `height`. */
function stand(kit: BuilderKit, root: THREE.Object3D, x: number, z: number, height: number, spread = 0.22, legAngle = 0) {
    const hub = Math.min(0.3, height * 0.4);
    for (let i = 0; i < 3; i++) {
        const a = legAngle + (i * 2 * Math.PI) / 3;
        root.add(kit.tube([x + Math.sin(a) * spread, 0.005, z + Math.cos(a) * spread], [x, hub, z], LEG_RADIUS, "metal"));
    }
    root.add(kit.tube([x, 0.01, z], [x, height, z], 0.012, "metal"));
}

export function buildDrumKit(kit: BuilderKit): THREE.Object3D {
    const root = kit.group("drum-kit");

    // bass drum lying on the floor, front head towards +Z
    const bassRadius = 0.28;
    const bassDepth = 0.42;
    const bassZ = 0.02;
    const bass = drum(kit, "bass-drum", bassRadius, bassDepth, true);
    bass.rotation.x = Math.PI / 2;
    bass.position.set(0, bassRadius + 0.006, bassZ);
    root.add(bass);
    // pedal behind the bass drum
    const pedal = kit.box([0.09, 0.03, 0.25], "metal");
    pedal.position.set(0, 0, bassZ - 0.14);
    root.add(pedal);
    // two spurs at the front
    for (const sx of [-1, 1]) {
        root.add(kit.tube([sx * 0.2, 0.12, bassZ + 0.32], [sx * 0.36, 0.005, bassZ + 0.38], LEG_RADIUS, "metal"));
    }

    // rack toms on the bass drum, tilted towards the drummer
    const bassTop = 2 * bassRadius + 0.006;
    for (const [x, radius, depth] of [
        [-0.17, 0.13, 0.18],
        [0.17, 0.15, 0.2],
    ]) {
        const tom = drum(kit, "tom", radius, depth, true);
        tom.rotation.set(-0.35, 0, x < 0 ? 0.15 : -0.15);
        tom.position.set(x, bassTop + 0.1, bassZ + 0.24);
        root.add(tom);
        root.add(kit.tube([0, bassTop - 0.02, bassZ + 0.22], [x * 0.8, bassTop + 0.1, bassZ + 0.22], 0.012, "metal"));
    }

    // snare on its stand, to the drummer's left (−X)
    const snare = { x: -0.4, z: -0.2, y: 0.55, radius: 0.18, depth: 0.14 };
    stand(kit, root, snare.x, snare.z, snare.y, 0.2, Math.PI / 3);
    const snareDrum = drum(kit, "snare", snare.radius, snare.depth, true);
    snareDrum.position.set(snare.x, snare.y, snare.z);
    root.add(snareDrum);

    // floor tom on three legs, to the drummer's right
    const floor = { x: 0.5, z: -0.15, radius: 0.2, depth: 0.38, y: 0.18 };
    const floorTom = drum(kit, "floor-tom", floor.radius, floor.depth, true);
    floorTom.position.set(floor.x, floor.y, floor.z);
    root.add(floorTom);
    for (let i = 0; i < 3; i++) {
        const a = Math.PI / 6 + (i * 2 * Math.PI) / 3;
        const ox = Math.sin(a);
        const oz = Math.cos(a);
        root.add(
            kit.tube(
                [floor.x + ox * (floor.radius + 0.06), 0.005, floor.z + oz * (floor.radius + 0.06)],
                [floor.x + ox * (floor.radius + 0.02), floor.y + floor.depth - 0.06, floor.z + oz * (floor.radius + 0.02)],
                LEG_RADIUS,
                "metal",
            ),
        );
    }

    // hi-hat: two cymbals on a stand left of the snare
    const hiHat = { x: -0.76, z: -0.05, y: 0.9 };
    stand(kit, root, hiHat.x, hiHat.z, hiHat.y + 0.06);
    root.add(cymbal(kit, [hiHat.x, hiHat.y, hiHat.z], 0.18));
    root.add(cymbal(kit, [hiHat.x, hiHat.y + 0.03, hiHat.z], 0.18));

    // crash (front left) and ride (right), slightly tilted towards the drummer
    const crash = { x: -0.62, z: 0.36, y: 1.24 };
    stand(kit, root, crash.x, crash.z, crash.y, 0.24, Math.PI);
    root.add(cymbal(kit, [crash.x, crash.y, crash.z], 0.23, -0.25));
    const ride = { x: 0.74, z: 0.25, y: 1.05 };
    stand(kit, root, ride.x, ride.z, ride.y, 0.24, Math.PI);
    root.add(cymbal(kit, [ride.x, ride.y, ride.z], 0.26, -0.2));

    // drum stool behind the kit
    const stool = { z: -0.62, height: 0.52 };
    stand(kit, root, 0, stool.z, stool.height - 0.07, 0.24, Math.PI / 3);
    const seat = kit.cylinder(0.18, 0.16, 0.08, "body", DRUM_SEGMENTS);
    seat.position.set(0, stool.height - 0.08, stool.z);
    root.add(seat);

    return kit.mergeBySlot(centerOnBase(kit, root, "drum-kit-base"));
}
