import { ref } from "vue";

/** Small shared UI state of the Stage view, so other components can switch tabs and select fixtures. */
export const STAGE_TAB_FIXTURES = 0;
export const STAGE_TAB_CONTROLLERS = 1;
export const STAGE_TAB_VISUALIZATION = 2;
export const STAGE_TAB_GROUPS = 3;

export const activeStageTab = ref(STAGE_TAB_FIXTURES);
export const selectedFixtureId = ref<string | null>(null);
