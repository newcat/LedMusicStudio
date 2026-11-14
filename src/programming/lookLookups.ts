/**
 * Store-aware lookups injected into the pure look evaluation (feature 004): presets from the library, profiles,
 * and aiming (R11) from the scene (fixture world matrix, model axes, pivot) and the profile's pan/tilt ranges.
 */

import { Matrix4 } from "three";
import { useLibrary } from "@/library/libraryModel";
import { useScene } from "@/scene/sceneStore";
import { getWorldMatrix } from "@/scene/model/transformMath";
import { isAimTarget, isFixtureVisualization, type Vec3 } from "@/scene/model/types";
import type { Axis } from "@/assetLibrary/types";
import { aimAt, DEFAULT_AIM_MODEL, type AimModel } from "./aim";
import { isPresetLibraryItem } from "./guards";
import type { LookLookups } from "./looks";
import { getProfile, getProgrammingContext } from "./profile";
import { fixtureName } from "./targets";

const AXES: Record<Axis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

function addWarning(warnings: string[], warning: string): void {
    if (!warnings.includes(warning)) {
        warnings.push(warning);
    }
}

export function lookLookups(): LookLookups {
    const library = useLibrary();
    const scene = useScene();
    return {
        profile: (fixtureId) => getProfile(fixtureId),
        preset: (presetId) => {
            const item = library.getItemById(presetId);
            return isPresetLibraryItem(item) ? item.state : null;
        },
        aim: (fixture, aimTargetId, warnings) => {
            const objects = scene.scene.objects;
            const target = objects[aimTargetId];
            if (!target || !isAimTarget(target)) {
                addWarning(warnings, "Aim target not found");
                return null;
            }
            const context = getProgrammingContext(fixture.fixtureId);
            const object = context?.sceneObjectId ? objects[context.sceneObjectId] : undefined;
            if (!context || !object || !isFixtureVisualization(object)) {
                addWarning(warnings, `${fixtureName(fixture.fixtureId)}: no scene position, not aimed`);
                return null;
            }
            const profile = context.profile;
            if (profile.panTiltNormalized) {
                addWarning(warnings, `${fixtureName(fixture.fixtureId)}: no pan/tilt angle range, not aimed`);
                return null;
            }
            const world = getWorldMatrix(scene.scene, object.id);
            const scale = Number.isFinite(object.modelScale) && object.modelScale > 0 ? object.modelScale : 1;
            world.multiply(new Matrix4().makeScale(scale, scale, scale));
            const e = getWorldMatrix(scene.scene, target.id).elements;
            const targetPosition: Vec3 = [e[12], e[13], e[14]];

            const description = context.model?.fixture;
            const pan = description?.movingParts?.pan;
            const tilt = description?.movingParts?.tilt;
            const model: AimModel = {
                panAxis: pan ? AXES[pan.axis] : DEFAULT_AIM_MODEL.panAxis,
                tiltAxis: tilt ? AXES[tilt.axis] : DEFAULT_AIM_MODEL.tiltAxis,
                beamDirection: description?.beam?.direction ?? DEFAULT_AIM_MODEL.beamDirection,
                pivot: tilt?.pivot ?? pan?.pivot,
            };
            const ranges = {
                pan: profile.ranges.pan ?? { min: -270, max: 270 },
                tilt: profile.ranges.tilt ?? { min: -135, max: 135 },
            };
            const result = aimAt(world.elements, targetPosition, model, ranges);
            return {
                pan: result.pan,
                tilt: result.tilt,
                warning: result.reachable ? undefined : `${fixtureName(fixture.fixtureId)}: target out of range`,
            };
        },
    };
}
