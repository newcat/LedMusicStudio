import { Ref, markRaw, ref } from "vue";
import { defineStore } from "pinia";
import * as Comlink from "comlink";

import { BaseFixture, FixtureState } from "./fixtures";
import { BaseController, ControllerState } from "./controllers";
import { StageVisualization, StageVisualizationState } from "./visualization/stageVisualization";
import { createFixture } from "./fixtures/factory";
import { createController } from "./controllers/factory";
import { ExtendedMap } from "./extendedMap";

import VisualizationWorker from "./visualization/visualization.worker?worker";
import { RemoteStageRenderer } from "./visualization/stageRenderer";

export interface StageState {
    fixtures: FixtureState[];
    controllers: ControllerState[];
    visualization: StageVisualizationState;
}

const outsideRenderer = Comlink.wrap<RemoteStageRenderer>(new VisualizationWorker());
const rendererProxy = new Proxy<typeof outsideRenderer>({} as any, {
    get(target: any, prop) {
        if (typeof prop === "string" && prop.startsWith("__v_")) {
            return target[prop];
        }
        return (outsideRenderer as any)[prop];
    },
    set(target: any, prop, value) {
        if (typeof prop === "string" && prop.startsWith("__v_")) {
            target[prop] = value;
            return true;
        }
        (outsideRenderer as any)[prop] = value;
        return true;
    },
});

export const useStage = defineStore("stage", () => {
    const fixtures = ref<ExtendedMap<string, BaseFixture>>(new ExtendedMap()) as Ref<ExtendedMap<string, BaseFixture>>;
    const controllers = ref<ExtendedMap<string, BaseController>>(new ExtendedMap()) as Ref<ExtendedMap<string, BaseController>>;
    const renderer = markRaw(rendererProxy) as RemoteStageRenderer;
    const visualization = ref(new StageVisualization(fixtures.value));

    function afterFrame() {
        for (const controller of controllers.value.values()) {
            void controller.send();
        }
    }

    function save(): StageState {
        return {
            fixtures: fixtures.value.getArray().map((f) => f.save()),
            controllers: controllers.value.getArray().map((c) => c.save()),
            visualization: visualization.value.save(),
        };
    }

    function load(state: StageState) {
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

        visualization.value.load(state.visualization);
    }

    function reset() {
        fixtures.value.clear();
        controllers.value.clear();
        visualization.value.reset();
    }

    return { fixtures, controllers, visualization, renderer, afterFrame, save, load, reset };
});
