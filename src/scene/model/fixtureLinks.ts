/**
 * Load-time migration (feature 006, research R9, data-model → Load-time migration): every fixture gets exactly one
 * fixture object and every fixture object gets a fixture. Runs before `scene.load`, so it is not part of the history.
 * Pure: returns a new scene and the fixtures to create; the caller applies them.
 */
import { v4 as uuidv4 } from "uuid";

import { FixtureType, type BaseFixture, type FixtureSnapshot } from "@/stage/fixtures/base.fixture";
import { createFixture } from "@/stage/fixtures/factory";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { getVisualizationByType } from "@/visualization/fixtureVisualizations/factory";
import type { LedStripVisualizationConfig } from "@/visualization/fixtureVisualizations/ledStrip/types";
import { stripPathLedCount } from "@/visualization/fixtureVisualizations/ledStrip/stripPath";
import { modelForType, preselectionOf, withModelRanges } from "../fixtureModels";
import { createFixtureVisualizationObject, createGroupObject } from "./defaults";
import { isFixtureVisualization, type FixtureVisualizationObject, type SceneState } from "./types";

export const UNPLACED_GROUP_NAME = "Unplaced fixtures";
/** Spacing of new objects in the "Unplaced fixtures" group, so they do not overlap. */
const UNPLACED_SPACING = 0.5;

export interface FixtureStateInput {
    id: string;
    type: FixtureType;
    name: string;
    config: unknown;
}

export interface FixtureLinkReport {
    /** fixtures that got a new object in "Unplaced fixtures" */
    placed: number;
    /** fixtures created for unlinked fixture objects */
    created: number;
    /** objects renamed to their fixture's name */
    renamed: number;
}

/** A detached fixture instance for computing default configs and preselections (not added to any store). */
function detachedFixture(state: FixtureStateInput): BaseFixture {
    const fixture = createFixture(state.type);
    fixture.load({ id: state.id, type: state.type, name: state.name, value: fixture.value, config: structuredClone(state.config) as never });
    return fixture;
}

function newObjectFor(state: FixtureStateInput): FixtureVisualizationObject {
    const fixture = detachedFixture(state);
    const preselection = preselectionOf(fixture);
    const type = state.type === FixtureType.LED_STRIP ? VisualizationType.LED_STRIP : (preselection?.visualizationType ?? VisualizationType.GENERIC);
    const model = modelForType(fixture, type, true);
    const config = withModelRanges(
        type,
        getVisualizationByType(type).defaultConfig(fixture as never, model.modelId) as FixtureVisualizationObject["config"],
        model.modelId
    );
    const obj = createFixtureVisualizationObject(state.id, type, config, state.name, model);
    if (type === VisualizationType.LED_STRIP) {
        // like new strips: emitting downwards
        obj.rotation = [180, 0, 0];
    }
    return obj;
}

export function migrateFixtureLinks(
    input: SceneState,
    fixtures: FixtureStateInput[]
): { scene: SceneState; newFixtures: FixtureSnapshot[]; report: FixtureLinkReport } {
    const report: FixtureLinkReport = { placed: 0, created: 0, renamed: 0 };
    const newFixtures: FixtureSnapshot[] = [];
    const byId = new Map(fixtures.map((f) => [f.id, f]));
    const knownTypes = new Set<string>(Object.values(VisualizationType));
    let scene: SceneState | null = null;
    /** copy on first write, so an unchanged project is returned as is (FR-033) */
    const writable = (): SceneState => (scene ??= structuredClone(input));

    const linked = new Set<string>();
    for (const obj of Object.values(input.objects)) {
        if (!isFixtureVisualization(obj)) {
            continue;
        }
        const fixture = obj.fixtureId ? byId.get(obj.fixtureId) : undefined;
        if (fixture) {
            linked.add(fixture.id);
            // the fixture's name wins (FR-032)
            if (obj.name !== fixture.name) {
                writable().objects[obj.id].name = fixture.name;
                report.renamed++;
            }
            continue;
        }
        // objects of types this version does not know keep their stored state
        if (!knownTypes.has(obj.visualizationType)) {
            continue;
        }
        const type = obj.visualizationType === VisualizationType.LED_STRIP ? FixtureType.LED_STRIP : FixtureType.DMX;
        const id = uuidv4();
        const config = structuredClone(createFixture(type).config) as Record<string, unknown>;
        if (type === FixtureType.LED_STRIP) {
            const path = (obj.config as LedStripVisualizationConfig).path;
            config.numLeds = path ? stripPathLedCount(path) : 1;
        }
        newFixtures.push({ state: { id, type, name: obj.name, config }, controllerId: null, groups: [] });
        (writable().objects[obj.id] as FixtureVisualizationObject).fixtureId = id;
        report.created++;
    }

    const unplaced = fixtures.filter((f) => !linked.has(f.id));
    if (unplaced.length > 0) {
        const target = writable();
        let group = target.rootOrder.map((id) => target.objects[id]).find((o) => o?.kind === "group" && o.name === UNPLACED_GROUP_NAME);
        if (!group) {
            group = createGroupObject({ name: UNPLACED_GROUP_NAME });
            target.objects[group.id] = group;
            target.rootOrder.push(group.id);
        }
        const offset = group.children.length;
        unplaced.forEach((state, index) => {
            const obj = newObjectFor(state);
            obj.parentId = group.id;
            obj.position = [(offset + index) * UNPLACED_SPACING, 0, 0];
            target.objects[obj.id] = obj;
            group.children.push(obj.id);
            report.placed++;
        });
    }

    return { scene: scene ?? input, newFixtures, report };
}
