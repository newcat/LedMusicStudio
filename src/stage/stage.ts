import { ref } from "vue";
import { defineStore } from "pinia";
import { BaseFixture } from "./fixtures";
import { BaseController } from "./controllers";

export const useStage = defineStore("stage", () => {
    const fixtures = ref<BaseFixture[]>([]);
    const controllers = ref<BaseController[]>([]);

    return { fixtures, controllers };
});
