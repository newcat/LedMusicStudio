import { Ref, ref } from "vue";
import { defineStore } from "pinia";
import { BaseFixture } from "./fixtures";
import { BaseController } from "./controllers";
import { StageVisualization } from "./visualization/stageVisualization";

export class ExtendedMap<K, V> extends Map<K, V> {
    public getArray(): V[] {
        return Array.from(this.values());
    }
}

export const useStage = defineStore("stage", () => {
    const fixtures = ref<ExtendedMap<string, BaseFixture>>(new ExtendedMap()) as Ref<ExtendedMap<string, BaseFixture>>;
    const controllers = ref<ExtendedMap<string, BaseController>>(new ExtendedMap()) as Ref<ExtendedMap<string, BaseController>>;
    const visualization = new StageVisualization(fixtures.value);

    function afterFrame() {
        for (const controller of controllers.value.values()) {
            void controller.send();
        }
    }

    return { fixtures, controllers, visualization, afterFrame };
});
