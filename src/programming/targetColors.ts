/**
 * Stable colour per target (feature 005, research R4): FNV-1a hash of "kind:id" → hue. Pure, nothing is saved.
 */

import type { Target } from "./types";

function fnv1a(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function targetHue(target: Target): number {
    return fnv1a(`${target.kind}:${target.id}`) % 360;
}

/** `hsl(h 65% 55%)`, or null for no target. `alpha` (0–1) gives a translucent variant. */
export function targetColor(target: Target | null, alpha = 1): string | null {
    if (!target) {
        return null;
    }
    const h = targetHue(target);
    return alpha >= 1 ? `hsl(${h} 65% 55%)` : `hsl(${h} 65% 55% / ${alpha})`;
}
