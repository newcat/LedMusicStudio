import { Matrix4, MathUtils, Euler, Quaternion, Vector3 } from "three";

import { VisualizationType } from "@/visualization/fixtureVisualization";
import { createDefaultScene, createFixtureVisualizationObject } from "./defaults";
import type { FixtureVisualizationObject, LegacyStageVisualization, SceneState, Vec3 } from "./types";
import { fromMatrix } from "./transformMath";

type Rec = Record<string, unknown>;

function isVec3(v: unknown): v is Vec3 {
    return Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((n) => typeof n === "number" && Number.isFinite(n));
}

function rotationFromTo(from: Vector3, to: Vector3): Vec3 {
    const q = new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
    const e = new Euler().setFromQuaternion(q, "XYZ");
    return [MathUtils.radToDeg(e.x), MathUtils.radToDeg(e.y), MathUtils.radToDeg(e.z)];
}

function convertMovingHead(config: Rec): FixtureVisualizationObject | null {
    if (!isVec3(config.position) || !isVec3(config.rotation) || typeof config.channelMapping !== "object" || !config.channelMapping) {
        return null;
    }
    const obj = createFixtureVisualizationObject(null, VisualizationType.MOVING_HEAD, {
        channelMapping: config.channelMapping as never,
    });
    obj.position = [...config.position];
    obj.rotation = [...config.rotation];
    return obj;
}

function convertSpot(config: Rec): FixtureVisualizationObject | null {
    if (!isVec3(config.position) || !isVec3(config.target) || !Array.isArray(config.colorChannels)) {
        return null;
    }
    const position = new Vector3(...config.position);
    const dir = new Vector3(...config.target).sub(position);
    const obj = createFixtureVisualizationObject(null, VisualizationType.SPOT, {
        colorChannels: config.colorChannels as [number, number, number, number],
    });
    obj.position = [...config.position];
    if (dir.lengthSq() > 1e-12) {
        // feature 002 (research R3): spot models emit along local +Y, which has to point from position to target.
        // The object already has a modelId, so the 001 spot fix in sanitize.ts does not apply to it.
        obj.rotation = rotationFromTo(new Vector3(0, 1, 0), dir);
    } else {
        // no aim: the pre-scene spot pointed down (local -Y), which is now a 180° turn about X
        obj.rotation = [180, 0, 0];
    }
    return obj;
}

function convertLedStrip(config: Rec): FixtureVisualizationObject | null {
    if (!isVec3(config.start) || !isVec3(config.end)) {
        return null;
    }
    const start = new Vector3(...config.start);
    const stripWorld = new Vector3(...config.end).sub(start);
    const intensity = typeof config.intensity === "number" ? config.intensity : 0.001;

    // emission direction: local +Y has to match the old direction, made orthogonal to the strip
    let emit = isVec3(config.direction) ? new Vector3(...config.direction) : new Vector3(0, 1, 0);
    if (emit.lengthSq() < 1e-12) {
        emit = new Vector3(0, 1, 0);
    }
    if (stripWorld.lengthSq() > 1e-12) {
        const axis = stripWorld.clone().normalize();
        const ortho = emit.clone().sub(axis.clone().multiplyScalar(emit.dot(axis)));
        if (ortho.lengthSq() < 1e-8) {
            // direction is parallel to the strip: use any direction orthogonal to it
            ortho.copy(Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0));
            ortho.sub(axis.clone().multiplyScalar(ortho.dot(axis)));
        }
        emit = ortho;
    }
    const rotationQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), emit.clone().normalize());
    const localEnd = stripWorld.clone().applyQuaternion(rotationQuat.clone().invert());

    const obj = createFixtureVisualizationObject(null, VisualizationType.LED_STRIP, {
        intensity,
        start: [0, 0, 0],
        end: [localEnd.x, localEnd.y, localEnd.z],
    });
    const m = new Matrix4().compose(start, rotationQuat, new Vector3(1, 1, 1));
    const t = fromMatrix(m);
    obj.position = t.position;
    obj.rotation = t.rotation;
    return obj;
}

/**
 * Converts the pre-scene visualization state (research R11). `baseScene` is discarded.
 * The converted objects are named after their fixture id; the caller renames them to the fixture names.
 */
export function convertLegacyVisualization(legacy: LegacyStageVisualization, fixtureIds: Set<string>): SceneState {
    const scene = createDefaultScene();
    const states = (legacy && typeof legacy === "object" && legacy.visualizationStates) || {};
    for (const [fixtureId, state] of Object.entries(states)) {
        if (!fixtureIds.has(fixtureId) || !state || typeof state !== "object") {
            continue;
        }
        const config = (state.config ?? {}) as Rec;
        let obj: FixtureVisualizationObject | null = null;
        try {
            switch (state.type) {
                case VisualizationType.MOVING_HEAD:
                    obj = convertMovingHead(config);
                    break;
                case VisualizationType.SPOT:
                    obj = convertSpot(config);
                    break;
                case VisualizationType.LED_STRIP:
                    obj = convertLedStrip(config);
                    break;
            }
        } catch {
            obj = null;
        }
        if (!obj) {
            continue;
        }
        obj.fixtureId = fixtureId;
        obj.name = fixtureId;
        scene.objects[obj.id] = obj;
        scene.rootOrder.push(obj.id);
    }
    return scene;
}
