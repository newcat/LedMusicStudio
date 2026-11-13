import type { Ref } from "vue";

import type { StripPath } from "./types";

/** Injection key of the strip path tool API, provided by the scene editor (feature 003, T053). */
export const STRIP_PATH_TOOL_KEY = "stripPathTool";

export type StripPathToolMode = "drawing" | "editing";

/**
 * The small API the LED strip settings use to reach the editor's strip path tool. It is provided by
 * `SceneEditor.vue`; settings shown outside the scene editor (fixture settings) get none and hide the buttons.
 */
export interface StripPathToolApi {
    /** The running tool, null if none. */
    readonly state: Readonly<Ref<{ objectId: string; mode: StripPathToolMode } | null>>;
    /** Enters draw mode for the strip; its path is replaced when the drawing is finished. */
    draw(objectId: string): void;
    /** Enters path editing mode for the strip (point handles). */
    edit(objectId: string): void;
    /** Leaves the running tool (drawing is cancelled). */
    stop(): void;
    /** Sets the strip path as one undoable command; false if the path is invalid. */
    setPath(objectId: string, path: StripPath): boolean;
}
