import { Ref, ref, watch } from "vue";
import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";

import { ExtendedMap } from "@/utils/extendedMap";
import { VisualizationServer } from "@/visualization";
import { createDefaultScene } from "@/scene/model/defaults";
import { convertLegacyVisualization } from "@/scene/model/legacy";
import { sanitizeScene } from "@/scene/model/sanitize";
import { isFixtureVisualization, type LegacyStageVisualization, type PersistedSceneState, type SceneState } from "@/scene/model/types";
import { BroadcastSceneSink } from "@/scene/sceneSink";
import { useScene } from "@/scene/sceneStore";
import { emitSceneToast } from "@/scene/toastBus";
import { BaseFixture, FixtureState } from "./fixtures";
import { BaseController, ControllerState } from "./controllers";
import { createFixture } from "./fixtures/factory";
import { createController } from "./controllers/factory";
import { FixtureType } from "./fixtures/base.fixture";
import { GROUP_ORDERINGS, type FixtureGroup, type GroupOrdering } from "@/programming/types";

export interface StageState {
    fixtures: FixtureState[];
    controllers: ControllerState[];
    scene: PersistedSceneState;
    /** feature 004: fixture groups (default []) */
    groups?: FixtureGroup[];
}

/** Projects saved before the scene editor store the visualization instead of the scene. */
export interface LegacyStageState {
    fixtures: FixtureState[];
    controllers: ControllerState[];
    visualization?: LegacyStageVisualization;
}

export const useStage = defineStore("stage", () => {
    const fixtures = ref<ExtendedMap<string, BaseFixture>>(new ExtendedMap()) as Ref<ExtendedMap<string, BaseFixture>>;
    const controllers = ref<ExtendedMap<string, BaseController>>(new ExtendedMap()) as Ref<ExtendedMap<string, BaseController>>;
    const visualization = ref(new VisualizationServer(fixtures.value)) as Ref<VisualizationServer>;
    const scene = useScene();
    /** feature 004 (research R6): named, ordered groups of DMX fixtures. */
    const groups = ref<FixtureGroup[]>([]);

    // show windows get every scene change (protocol v3)
    scene.registerSink(
        new BroadcastSceneSink({
            getScene: () => scene.rawScene(),
            getFixtures: () => visualization.value.getConfigsAndValues(),
        }),
        false
    );

    watch(
        () => scene.scene.objects,
        (objects) => visualization.value.syncWithScene(objects),
        { deep: true, immediate: true }
    );

    // FR-019: deleted fixtures leave every group
    watch(
        () => Array.from(fixtures.value.keys()).join(","),
        () => {
            for (const group of groups.value) {
                const kept = group.fixtureIds.filter((id) => fixtures.value.has(id));
                if (kept.length !== group.fixtureIds.length) {
                    group.fixtureIds = kept;
                }
            }
        }
    );

    function isDmxFixture(id: string): boolean {
        return fixtures.value.get(id)?.type === FixtureType.DMX;
    }

    /** `name`, or `name (2)`, `name (3)`, … if another group already uses it. */
    function uniqueGroupName(name: string, exceptId?: string): string {
        const base = name.trim() || "Group";
        const taken = new Set(groups.value.filter((g) => g.id !== exceptId).map((g) => g.name));
        if (!taken.has(base)) {
            return base;
        }
        let i = 2;
        while (taken.has(`${base} (${i})`)) {
            i++;
        }
        return `${base} (${i})`;
    }

    function getGroup(id: string): FixtureGroup | undefined {
        return groups.value.find((g) => g.id === id);
    }

    function addGroup(name: string): FixtureGroup {
        const group: FixtureGroup = { id: uuidv4(), name: uniqueGroupName(name), fixtureIds: [], ordering: "manual" };
        groups.value.push(group);
        return groups.value[groups.value.length - 1];
    }

    function renameGroup(id: string, name: string) {
        const group = getGroup(id);
        if (group && name.trim()) {
            group.name = uniqueGroupName(name, id);
        }
    }

    function removeGroup(id: string) {
        groups.value = groups.value.filter((g) => g.id !== id);
    }

    function setGroupMembers(id: string, fixtureIds: string[]) {
        const group = getGroup(id);
        if (group) {
            group.fixtureIds = Array.from(new Set(fixtureIds)).filter(isDmxFixture);
        }
    }

    function setGroupOrdering(id: string, ordering: GroupOrdering) {
        const group = getGroup(id);
        if (group) {
            group.ordering = ordering;
        }
    }

    function moveGroupMember(id: string, from: number, to: number) {
        const group = getGroup(id);
        if (!group || from < 0 || from >= group.fixtureIds.length || to < 0 || to >= group.fixtureIds.length) {
            return;
        }
        const ids = group.fixtureIds.slice();
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        group.fixtureIds = ids;
    }

    function loadGroups(state: unknown) {
        const result: FixtureGroup[] = [];
        if (Array.isArray(state)) {
            for (const raw of state as Array<Partial<FixtureGroup>>) {
                if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") {
                    continue;
                }
                const ordering = GROUP_ORDERINGS.some((o) => o.value === raw.ordering) ? (raw.ordering as GroupOrdering) : "manual";
                const ids = Array.isArray(raw.fixtureIds) ? raw.fixtureIds.filter((id): id is string => typeof id === "string") : [];
                result.push({ id: raw.id, name: raw.name || "Group", fixtureIds: Array.from(new Set(ids)).filter(isDmxFixture), ordering });
            }
        }
        groups.value = result;
    }

    function afterFrame() {
        for (const controller of controllers.value.values()) {
            void controller.send();
        }
    }

    function save(): StageState {
        return {
            fixtures: fixtures.value.getArray().map((f) => f.save()),
            controllers: controllers.value.getArray().map((c) => c.save()),
            scene: scene.save(),
            groups: groups.value.map((g) => ({ ...g, fixtureIds: [...g.fixtureIds] })),
        };
    }

    function loadScene(state: StageState | LegacyStageState): void {
        let sceneState: SceneState;
        let problems: string[] = [];
        let unknownAssets = 0;
        let unknownModels = 0;

        if ("scene" in state && state.scene) {
            ({ scene: sceneState, problems, unknownAssets, unknownModels } = sanitizeScene(state.scene));
        } else if ("visualization" in state && state.visualization) {
            sceneState = convertLegacyVisualization(state.visualization, new Set(fixtures.value.keys()));
            for (const obj of Object.values(sceneState.objects)) {
                if (isFixtureVisualization(obj) && obj.fixtureId) {
                    obj.name = fixtures.value.get(obj.fixtureId)?.name ?? obj.name;
                }
            }
            emitSceneToast({
                severity: "info",
                summary: "Old project format",
                detail: "This project was created with an older version. The static stage scene could not be converted and must be rebuilt; fixture visualizations were kept where possible.",
                life: 10000,
            });
        } else {
            sceneState = createDefaultScene();
        }

        // data-model invariants 3 and 5: links must point to existing fixtures, one object per fixture
        const linked = new Set<string>();
        for (const obj of Object.values(sceneState.objects)) {
            if (isFixtureVisualization(obj) && obj.fixtureId) {
                if (!fixtures.value.has(obj.fixtureId) || linked.has(obj.fixtureId)) {
                    obj.fixtureId = null;
                } else {
                    linked.add(obj.fixtureId);
                }
            }
        }

        scene.load(sceneState);

        if (problems.length > 0) {
            console.warn("Scene problems:", problems);
            emitSceneToast({
                severity: "warn",
                summary: "Problems while loading the scene",
                detail: `${problems.length} problem${problems.length === 1 ? "" : "s"} found; affected objects were repaired or replaced by placeholders.`,
                life: 8000,
            });
        }
        // feature 002, contracts/library-ui.md → Messages
        if (unknownAssets > 0) {
            emitSceneToast({
                severity: "warn",
                summary: "Unknown assets",
                detail: `${unknownAssets} objects use assets that are not available and are shown as placeholders.`,
                life: 8000,
            });
        }
        if (unknownModels > 0) {
            emitSceneToast({
                severity: "warn",
                summary: "Unknown fixture models",
                detail: `${unknownModels} fixture visualizations use unknown models; the generic fixture is shown.`,
                life: 8000,
            });
        }
    }

    function load(state: StageState | LegacyStageState) {
        for (const fixtureState of state.fixtures) {
            const fixture = createFixture(fixtureState.type);
            fixture.load(fixtureState);
            fixtures.value.set(fixture.id, fixture);
        }

        for (const controllerState of state.controllers) {
            const controller = createController(controllerState.type);
            controller.load(controllerState, fixtures.value);
            controllers.value.set(controller.id, controller);
        }

        loadScene(state);
        loadGroups("groups" in state ? state.groups : undefined);
    }

    function reset() {
        fixtures.value.clear();
        controllers.value.clear();
        groups.value = [];
        scene.reset();
    }

    return {
        fixtures,
        controllers,
        visualization,
        groups,
        afterFrame,
        save,
        load,
        reset,
        getGroup,
        addGroup,
        renameGroup,
        removeGroup,
        setGroupMembers,
        setGroupOrdering,
        moveGroupMember,
    };
});
