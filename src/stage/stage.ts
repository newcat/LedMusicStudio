import { Ref, ref } from "vue";
import { defineStore } from "pinia";
import { BaseFixture, FixtureState } from "./fixtures";
import { BaseController, ControllerState } from "./controllers";
import { StageVisualization, StageVisualizationState } from "./visualization/stageVisualization";
import { createFixture } from "./fixtures/factory";
import { createController } from "./controllers/factory";

export class ExtendedMap<K, V> extends Map<K, V> {
    public getArray(): V[] {
        return Array.from(this.values());
    }
}

export interface StageState {
    fixtures: FixtureState[];
    controllers: ControllerState[];
    visualization: StageVisualizationState;
}

export const useStage = defineStore("stage", () => {
    const fixtures = ref<ExtendedMap<string, BaseFixture>>(new ExtendedMap()) as Ref<ExtendedMap<string, BaseFixture>>;
    const controllers = ref<ExtendedMap<string, BaseController>>(new ExtendedMap()) as Ref<ExtendedMap<string, BaseController>>;
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

    return { fixtures, controllers, visualization, afterFrame, save, load };
});
