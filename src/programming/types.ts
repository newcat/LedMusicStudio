/**
 * Shared types of the programming engine (feature 004, contracts/engine.ts, data-model §3–§5).
 * Type-only module: no Vue/Pinia imports.
 */

import type { AttributeKey, AttributeValue } from "./attributes";
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

export const GROUP_ORDERINGS: Array<{ value: GroupOrdering; label: string }> = [
    { value: "manual", label: "Manual" },
    { value: "leftToRight", label: "Left to right" },
    { value: "rightToLeft", label: "Right to left" },
    { value: "frontToBack", label: "Front to back" },
    { value: "backToFront", label: "Back to front" },
    { value: "bottomToTop", label: "Bottom to top" },
    { value: "topToBottom", label: "Top to bottom" },
    { value: "distanceFromCenter", label: "Distance from center" },
];

export interface FixtureGroup {
    id: string;
    name: string;
    /** DMX fixtures only, no duplicates; manual order. */
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

export function sameTarget(a: Target | null | undefined, b: Target | null | undefined): boolean {
    return (!a && !b) || (!!a && !!b && a.kind === b.kind && a.id === b.id);
}

export function isTarget(value: unknown): value is Target {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const v = value as Record<string, unknown>;
    return (v.kind === "group" || v.kind === "fixture") && typeof v.id === "string" && v.id.length > 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Contributions and merge
// ---------------------------------------------------------------------------------------------------------------

/** [trackIndex, itemStart]; lexicographically larger wins (R4). */
export type Priority = readonly [number, number];

export function comparePriority(a: Priority, b: Priority): number {
    return a[0] - b[0] || a[1] - b[1];
}

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
