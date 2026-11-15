import { ref } from "vue";

/** Small shared UI state of the Stage view, so other components can switch tabs and focus scene objects. */
export const STAGE_TAB_CONTROLLERS = 0;
export const STAGE_TAB_VISUALIZATION = 1;
export const STAGE_TAB_GROUPS = 2;

export const activeStageTab = ref(STAGE_TAB_VISUALIZATION);
