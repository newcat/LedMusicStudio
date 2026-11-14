import { defineNode } from "baklavajs";
import { CheckboxInterface, NumberInterface } from "../../interfaces";
import { LmsCalculationContext } from "../../types";

/**
 * Fixture Input (feature 004, FR-021): the fixture of the current per-fixture run. A graph with this node runs once
 * per fixture of its Attribute Outputs' common target. Outside a per-fixture run: 0, 0, 0, 0, 0, false, 1.
 */
export const FixtureInputNode = defineNode({
    type: "Fixture Input",
    outputs: {
        index: () => new NumberInterface("Index", 0).setComponent(undefined),
        normalizedIndex: () => new NumberInterface("Normalized Index", 0).setComponent(undefined),
        x: () => new NumberInterface("X", 0).setComponent(undefined),
        y: () => new NumberInterface("Y", 0).setComponent(undefined),
        z: () => new NumberInterface("Z", 0).setComponent(undefined),
        hasPosition: () => new CheckboxInterface("Has Position", false).setComponent(undefined),
        groupSize: () => new NumberInterface("Group Size", 1).setComponent(undefined),
    },
    calculate(_inputs, context: LmsCalculationContext) {
        const f = context.globalValues.fixture;
        if (!f) {
            return { index: 0, normalizedIndex: 0, x: 0, y: 0, z: 0, hasPosition: false, groupSize: 1 };
        }
        return {
            index: f.index,
            normalizedIndex: f.normalizedIndex,
            x: f.position?.[0] ?? 0,
            y: f.position?.[1] ?? 0,
            z: f.position?.[2] ?? 0,
            hasPosition: f.position !== null,
            groupSize: f.groupSize,
        };
    },
});
