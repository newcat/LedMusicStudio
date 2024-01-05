import { ref } from "vue";
import { defineStore } from "pinia";
import { BaseFixture } from "./fixtures";
import { BaseController } from "./controllers";

class ExtendedMap<K, V> extends Map<K, V> {
    public getArray(): V[] {
        return Array.from(this.values());
    }
}

export const useStage = defineStore("stage", () => {
    const fixtures = ref<ExtendedMap<string, BaseFixture>>(new ExtendedMap());
    const controllers = ref<ExtendedMap<string, BaseController>>(new ExtendedMap());

    function afterFrame() {
        for (const controller of controllers.value.values()) {
            void controller.send();
        }
    }

    return { fixtures, controllers, afterFrame };
});
