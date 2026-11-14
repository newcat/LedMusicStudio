import type { ICalculationData } from "../types";

const states = new WeakMap<object, Map<number, unknown>>();

/**
 * Instance state of a stateful node, kept per fixture of a per-fixture graph run (feature 004, R7), so that
 * running a graph once per fixture does not mix the state of different fixtures. Outside per-fixture runs the key
 * is 0, so behavior is unchanged.
 */
export function perFixtureState<T>(owner: object, ctx: { globalValues: ICalculationData }, init: () => T): T {
    let map = states.get(owner) as Map<number, T> | undefined;
    if (!map) {
        map = new Map<number, T>();
        states.set(owner, map);
    }
    const key = ctx.globalValues.fixture?.index ?? 0;
    let state = map.get(key);
    if (state === undefined) {
        state = init();
        map.set(key, state);
    }
    return state;
}
