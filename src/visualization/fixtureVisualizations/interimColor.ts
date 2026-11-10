import * as THREE from "three";

import { decodeScalar } from "../capabilities/decode";
import type { CapabilityMapping } from "../capabilities/types";

const COLOR_KEYS = ["red", "green", "blue", "white"] as const;

/**
 * Interim RGB(W) × dimmer decoding for the beam and generic renderers until the full color decoder (US1).
 * White when no color key has a channel (FR-003), full output when the dimmer is unmapped.
 */
export function decodeSimpleColor(mapping: CapabilityMapping, values: Uint8Array, out: THREE.Color): THREE.Color {
    const channels = mapping.channels;
    let r = 1;
    let g = 1;
    let b = 1;
    if (COLOR_KEYS.some((key) => (channels[key]?.channel ?? -1) >= 0)) {
        const white = decodeScalar(channels.white, values, 0, "white");
        r = decodeScalar(channels.red, values, 0, "red") + white;
        g = decodeScalar(channels.green, values, 0, "green") + white;
        b = decodeScalar(channels.blue, values, 0, "blue") + white;
    }
    const dimmer = Math.max(0, decodeScalar(channels.dimmer, values, 1, "dimmer"));
    return out.setRGB(Math.max(0, r) * dimmer, Math.max(0, g) * dimmer, Math.max(0, b) * dimmer);
}

/** True if the object and all its ancestors are visible. */
export function isInVisibleHierarchy(obj: THREE.Object3D | null): boolean {
    for (let current = obj; current; current = current.parent) {
        if (!current.visible) {
            return false;
        }
    }
    return true;
}
