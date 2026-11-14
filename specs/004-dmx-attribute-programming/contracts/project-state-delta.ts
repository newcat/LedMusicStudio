/**
 * Saved project state added by feature 004 (research R14, data-model). All additions are optional on load:
 * missing fields load as the listed default, so projects from before this feature load unchanged.
 */

import type { AttributeKey, AttributeValue, AttributeValues, Rgb } from "./attributes";
import type { FixtureGroup, Target } from "./engine";
import type { SceneObjectBase } from "@/scene/model/types";

// --- Stage (src/stage/stage.ts: StageState) --------------------------------------------------------------------

export interface StageStateDelta {
    /** default [] */
    groups?: FixtureGroup[];
}

/** src/stage/fixtures/dmx/dmx.fixture.ts: DmxFixtureConfiguration */
export interface DmxFixtureConfigurationDelta {
    /** Per-fixture default overrides (FR-012), default {}. Invalid values are dropped on load. */
    defaults?: AttributeValues;
}

// --- Timeline (src/timeline/model) ----------------------------------------------------------------------------

export interface TrackStateDelta {
    /** default null */
    defaultTarget?: Target | null;
}

export interface ItemStateDelta {
    /** default null; set from the track's defaultTarget when the item is created */
    target?: Target | null;
    /** timeline units (24 per beat), default 0; used by LOOK and EFFECT items only */
    fadeIn?: number;
    fadeOut?: number;
}

// --- Library (src/library/libraryItem.ts: new LibraryItemType values LOOK, EFFECT, PRESET) -------------------

export type LookValue =
    | { kind: "single"; value: AttributeValue }
    | { kind: "fan"; from: AttributeValue; to: AttributeValue; mirror: boolean }
    | { kind: "preset"; presetId: string }
    /** only under key "pan"; sets pan and tilt */
    | { kind: "aim"; aimTargetId: string };

export interface LookState {
    id: string;
    name: string;
    values: Partial<Record<AttributeKey, LookValue>>;
    /** 0..1, default 0 */
    fanTiming: number;
    /** Only written when a referenced preset is deleted (bake, R10). default {} */
    perFixture: Record<string, AttributeValues>;
}

export interface EffectState {
    id: string;
    name: string;
    attribute: "dimmer" | "pan" | "tilt" | "panTilt" | "zoom" | "focus" | "color";
    shape: "sine" | "triangle" | "sawUp" | "sawDown" | "square" | "circle" | "figure8";
    mode: "relative" | "absolute";
    size: number | [number, number];
    base: number | [number, number];
    colors: [Rgb, Rgb];
    /** > 0, default 1 */
    rateBeats: number;
    /** degrees 0..720, default 360 */
    spread: number;
    /** integers ≥ 1, default 1 */
    wings: number;
    blocks: number;
    interleave: number;
    direction: "forward" | "backward";
}

export interface PresetState {
    id: string;
    name: string;
    presetKind: "position" | "color" | "beam";
    common: AttributeValues;
    perFixture: Record<string, AttributeValues>;
    /** position only; overrides pan/tilt values when set. default null */
    aimTargetId: string | null;
}

// --- Scene (src/scene/model/types.ts) -------------------------------------------------------------------------

/** New known kind "aimTarget"; rotation/scale ignored. Editor-only gizmo, not rendered in the show window. */
export type AimTargetObject = SceneObjectBase<"aimTarget">;
