/**
 * Programming engine contract (feature 004, research R4, R6–R9, R11; data-model §3–§8).
 * Implemented in src/programming/{engine,targets,effects,looks,aim}.ts. engine.ts is called once per frame by
 * BaseTimelineProcessor.process() in place of applyGraphResults/uncontrolledFixtures for DMX fixtures.
 */

import type { AttributeKey, AttributeValue, AttributeValues, Rgb } from "./attributes";
import type { Vec3 } from "@/scene/model/types";

// ---------------------------------------------------------------------------------------------------------------
// Targets and groups
// ---------------------------------------------------------------------------------------------------------------

export type Target = { kind: "group"; id: string } | { kind: "fixture"; id: string };

export type GroupOrdering =
    | "manual"
    | "leftToRight"
    | "rightToLeft"
    | "frontToBack"
    | "backToFront"
    | "bottomToTop"
    | "topToBottom"
    | "distanceFromCenter";

export interface FixtureGroup {
    id: string;
    name: string;
    fixtureIds: string[];
    ordering: GroupOrdering;
}

export interface ResolvedFixture {
    fixtureId: string;
    index: number;
    /** 0 for the first, 1 for the last, 0 for a single fixture (FR-021). */
    normalizedIndex: number;
    /** World position of the linked visualization object; null without scene object. */
    position: Vec3 | null;
}

export interface ResolvedTarget {
    fixtures: ResolvedFixture[];
    /** e.g. "Group not found", "Group is empty". Shown as a badge on the item. */
    warnings: string[];
}

/** targets.ts (uses stage + scene stores; group orders cached as computed values) */
export type ResolveTarget = (target: Target | null) => ResolvedTarget;

// ---------------------------------------------------------------------------------------------------------------
// Contributions and merge
// ---------------------------------------------------------------------------------------------------------------

/** [trackIndex, itemStart]; lexicographically larger wins (R4). */
export type Priority = readonly [number, number];

export interface AttributeContribution {
    value: AttributeValue;
    /** "relative" only for numeric continuous attributes (effects); value is an offset. */
    mode: "absolute" | "relative";
    /** 0..1 (fades). */
    weight: number;
}

export interface Contribution {
    fixtureId: string;
    priority: Priority;
    attributes: Partial<Record<AttributeKey, AttributeContribution>>;
    /** Raw DMX output node: channel index → 0..255. */
    raw: Map<number, number> | null;
}

export interface FrameResult {
    /** fixtureId → channel values, passed to DmxFixture.setValue. Every DMX fixture is present. */
    values: Map<string, number[]>;
    /** itemId → warnings for the timeline badge (missing targets, unreachable aim targets, …). */
    warnings: Map<string, string[]>;
}

/**
 * engine.ts. Stateless (FR-011): the result depends only on its arguments. Fold order per fixture:
 * defaults → contributions sorted by priority (absolute: lerp by weight / discrete switch at 0.5; relative: add and
 * clamp) → encode → raw override per channel where the raw priority is higher than the writing attribute's.
 */
export type MergeFrame = (contributions: Contribution[], dmxFixtureIds: string[]) => FrameResult;

// ---------------------------------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------------------------------

export interface ItemContext {
    itemId: string;
    priority: Priority;
    /** Timeline units since item start, and item length. */
    localPosition: number;
    length: number;
    fadeIn: number;
    fadeOut: number;
    target: ResolvedTarget;
}

/** looks.ts: one contribution per target fixture, with fan values, fan timing and preset/aim resolution (R9). */
export type EvaluateLook = (look: LookStateRef, ctx: ItemContext) => Contribution[];

/** effects.ts (R8) */
export type EffectShape = "sine" | "triangle" | "sawUp" | "sawDown" | "square" | "circle" | "figure8";
/** Phase offset in degrees for position `i` of `n` (group order), per R8. */
export type PhaseOffset = (i: number, n: number, spread: number, wings: number, blocks: number, interleave: number, backward: boolean) => number;
/** −1..1; circle/figure8 return [pan, tilt]. `t` in cycles. */
export type EvaluateShape = (shape: EffectShape, t: number) => number | [number, number];
export type EvaluateEffect = (effect: EffectStateRef, ctx: ItemContext) => Contribution[];

/** Graph items: Attribute Output results → contributions; raw DMX output results → raw contributions. */
export type GraphOutputsToContributions = (results: GraphOutputResult[], ctx: ItemContext) => Contribution[];

export interface GraphOutputResult {
    fixtureIds: string[];
    attributes: AttributeValues;
}

// Opaque references to the saved states in project-state-delta.ts
export type LookStateRef = import("./project-state-delta").LookState;
export type EffectStateRef = import("./project-state-delta").EffectState;

// ---------------------------------------------------------------------------------------------------------------
// Aim (R11)
// ---------------------------------------------------------------------------------------------------------------

export interface AimResult {
    pan: number;
    tilt: number;
    /** false = target outside the pan/tilt range; values are clamped (FR-034). */
    reachable: boolean;
}

/**
 * aim.ts: pure inverse kinematics. `fixtureWorld` is the column-major 4×4 world matrix of the visualization object
 * (incl. modelScale); axes/beam come from the model's FixtureModelDescription (defaults: pan Y, tilt X, beam +Y).
 * Of the two solutions, the reachable one with |pan| closest to 0 wins.
 */
export type AimAt = (
    fixtureWorld: ArrayLike<number>,
    target: Vec3,
    model: { panAxis: Vec3; tiltAxis: Vec3; beamDirection: Vec3 },
    ranges: { pan: { min: number; max: number }; tilt: { min: number; max: number } }
) => AimResult;

/** Color interpolation in linear RGB (R9). */
export type LerpColor = (a: Rgb, b: Rgb, t: number) => Rgb;
