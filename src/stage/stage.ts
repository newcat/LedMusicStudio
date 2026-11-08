import { Ref, ref, watch } from "vue";
import { defineStore } from "pinia";

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

export interface StageState {
    fixtures: FixtureState[];
    controllers: ControllerState[];
    scene: PersistedSceneState;
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

    // show windows get every scene change (protocol v2)
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
    }

    function reset() {
        fixtures.value.clear();
        controllers.value.clear();
        scene.reset();
    }

    return { fixtures, controllers, visualization, afterFrame, save, load, reset };
});
