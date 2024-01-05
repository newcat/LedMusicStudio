import { Ref, ref } from "vue";
import { defineStore } from "pinia";
import { BaseFixture } from "./fixtures";
import { BaseController } from "./controllers";

interface StageStore {
    fixtures: BaseFixture[];
    controllers: BaseController[];
}

export const useStage = defineStore("stage", () => {
    const fixtures = ref<BaseFixture[]>([]) as Ref<BaseFixture[]>;
    const controllers = ref<BaseController[]>([]) as Ref<BaseController[]>;

    return { fixtures, controllers };
});
