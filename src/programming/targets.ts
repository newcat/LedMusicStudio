/**
 * Target resolution and group ordering (feature 004, research R6, contracts/engine.ts `ResolveTarget`).
 * Reads the stage and scene stores; group orders are cached as computed values and follow fixture moves.
 */

import { computed, type ComputedRef } from "vue";
import { useScene } from "@/scene/sceneStore";
import { getWorldMatrix } from "@/scene/model/transformMath";
import { isFixtureVisualization, type Vec3 } from "@/scene/model/types";
import { FixtureType, useStage } from "@/stage";
import { useTimeline } from "@/timeline/model/editor";
import type { Item } from "@/timeline/model/item";
import type { FixtureGroup, ResolvedFixture, ResolvedTarget, Target } from "./types";

/** World position of the visualization object linked to each fixture (reactive). */
const fixturePositions = computed(() => {
    const scene = useScene();
    const objects = scene.scene.objects;
    const positions = new Map<string, Vec3>();
    for (const obj of Object.values(objects)) {
        if (isFixtureVisualization(obj) && obj.fixtureId) {
            const e = getWorldMatrix(scene.scene, obj.id).elements;
            positions.set(obj.fixtureId, [e[12], e[13], e[14]]);
        }
    }
    return positions;
});

export function fixturePosition(fixtureId: string): Vec3 | null {
    return fixturePositions.value.get(fixtureId) ?? null;
}

function sortKey(group: FixtureGroup, p: Vec3): number {
    switch (group.ordering) {
        case "leftToRight":
            return p[0];
        case "rightToLeft":
            return -p[0];
        // the audience is at +Z (default camera)
        case "frontToBack":
            return -p[2];
        case "backToFront":
            return p[2];
        case "bottomToTop":
            return p[1];
        case "topToBottom":
            return -p[1];
        case "distanceFromCenter":
            return Math.hypot(p[0], p[1], p[2]);
        default:
            return 0;
    }
}

/** Resolved order of a group's members: manual, or by scene position with ties by manual order (R6). */
export function orderGroup(group: FixtureGroup, positionOf: (fixtureId: string) => Vec3 | null): ResolvedFixture[] {
    const entries = group.fixtureIds.map((fixtureId, manual) => ({ fixtureId, manual, position: positionOf(fixtureId) }));
    if (group.ordering !== "manual") {
        const EPS = 1e-6;
        entries.sort((a, b) => {
            if (!a.position || !b.position) {
                // fixtures without a scene object come last, in manual order
                return (a.position ? 0 : 1) - (b.position ? 0 : 1) || a.manual - b.manual;
            }
            const d = sortKey(group, a.position) - sortKey(group, b.position);
            return Math.abs(d) > EPS ? d : a.manual - b.manual;
        });
    }
    const n = entries.length;
    return entries.map((e, index) => ({
        fixtureId: e.fixtureId,
        index,
        normalizedIndex: n > 1 ? index / (n - 1) : 0,
        position: e.position,
    }));
}

const groupOrders = new Map<string, ComputedRef<ResolvedFixture[] | null>>();

function groupOrder(groupId: string): ResolvedFixture[] | null {
    let order = groupOrders.get(groupId);
    if (!order) {
        order = computed(() => {
            const stage = useStage();
            const group = stage.groups.find((g) => g.id === groupId);
            if (!group) {
                return null;
            }
            return orderGroup(group, (id) => fixturePositions.value.get(id) ?? null);
        });
        groupOrders.set(groupId, order);
    }
    return order.value;
}

function fixtureName(fixtureId: string): string {
    return useStage().fixtures.get(fixtureId)?.name ?? fixtureId;
}

/** The target a clip programs: its own, or its track's default target for "inherit" (feature 005, R3). */
export function effectiveTarget(item: Item): Target | null {
    return item.target === "inherit" ? (useTimeline().getTrackById(item.trackId)?.defaultTarget ?? null) : item.target;
}

export function targetLabel(target: Target | null | undefined): string {
    if (!target) {
        return "No target";
    }
    const stage = useStage();
    if (target.kind === "group") {
        return stage.groups.find((g) => g.id === target.id)?.name ?? "Missing group";
    }
    return stage.fixtures.get(target.id)?.name ?? "Missing fixture";
}

/** Fixtures of a target in group order, with warnings for missing or empty targets (FR-019). */
export function resolveTarget(target: Target | null | undefined): ResolvedTarget {
    if (!target) {
        return { fixtures: [], warnings: ["No target"] };
    }
    const stage = useStage();
    if (target.kind === "fixture") {
        const fixture = stage.fixtures.get(target.id);
        if (!fixture || fixture.type !== FixtureType.DMX) {
            return { fixtures: [], warnings: ["Fixture not found"] };
        }
        return { fixtures: [{ fixtureId: target.id, index: 0, normalizedIndex: 0, position: fixturePosition(target.id) }], warnings: [] };
    }
    const order = groupOrder(target.id);
    if (!order) {
        return { fixtures: [], warnings: ["Group not found"] };
    }
    if (order.length === 0) {
        return { fixtures: [], warnings: ["Group is empty"] };
    }
    return { fixtures: order, warnings: [] };
}

export { fixtureName };

/** Encodes a target for select inputs: "group:<id>" / "fixture:<id>". */
export function encodeTarget(target: Target | null | undefined): string {
    return target ? `${target.kind}:${target.id}` : "";
}

export function decodeTarget(value: string | null | undefined): Target | null {
    if (!value) {
        return null;
    }
    const i = value.indexOf(":");
    const kind = value.slice(0, i);
    const id = value.slice(i + 1);
    return (kind === "group" || kind === "fixture") && id ? { kind, id } : null;
}
