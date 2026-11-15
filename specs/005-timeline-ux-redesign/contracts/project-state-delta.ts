/**
 * Saved-state delta of feature 005 (timeline UX redesign). Additive; projects saved before this feature load
 * unchanged (FR-020): their `target` is always a Target or null, which load as explicit target or "none".
 */

import type { Target } from "@/programming/types";

/** Clip target: a group/fixture, "inherit" (use the track's defaultTarget, live), or null (none). */
export type ClipTarget = Target | "inherit" | null;

/** Changes to `IItemState` (src/timeline/model/item.ts). */
export interface IItemStateDelta {
    /** CHANGED: may now also be the string "inherit". Default for new clips: "inherit". */
    target?: ClipTarget;
}

/** `ITrackState.defaultTarget` is unchanged in shape; it is now applied live to inheriting clips. */

/**
 * Load rules:
 * - target: isTarget(v) → explicit; v === "inherit" → "inherit"; anything else → null.
 * Not saved: selection, clipboard, undo history, follow-playhead toggle.
 */
export {};
