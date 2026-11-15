import type { InjectionKey } from "vue";

/** Scene editor actions that the inspector triggers (feature 006); provided by `SceneEditor.vue`. */
export interface EditorActions {
    /** Delete with the same confirmation as the Delete key (aim targets in use). */
    deleteSelection: () => void;
    /** Opens the DMX profile dialog for a fixture; the chosen profile is applied as one undo step. */
    chooseProfile: (fixtureId: string) => void;
}

export const EDITOR_ACTIONS_KEY: InjectionKey<EditorActions> = Symbol("editorActions");
