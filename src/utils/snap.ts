import { globalState } from "../globalState";

export function snap(unit: number): number {
    const mod = unit % globalState.snapUnits;
    return mod <= globalState.snapUnits / 2 ? unit - mod : unit + globalState.snapUnits - mod;
}
