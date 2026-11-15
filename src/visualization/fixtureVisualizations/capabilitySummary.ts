/**
 * Pure helpers of the compact channel mapping editor (feature 006, research R14): the mapped-channel count for the
 * section header and the muted summary line under each capability row.
 */
import type { KeyInfo } from "../capabilities/keys";
import type { CapabilityChannel, CapabilityMapping, WheelDefinition } from "../capabilities/types";

const UNIT_SUFFIX: Partial<Record<string, string>> = { deg: "°", K: " K", rps: " rps" };

/** Number of distinct fixture channels (coarse and fine, cells included) that the mapping uses, within `channelCount`. */
export function mappedChannelCount(mapping: CapabilityMapping, channelCount: number): number {
    const used = new Set<number>();
    const add = (index: number | undefined) => {
        if (index !== undefined && index >= 0 && index < channelCount) {
            used.add(index);
        }
    };
    for (const entry of Object.values(mapping.channels)) {
        if (entry && entry.channel >= 0) {
            add(entry.channel);
            add(entry.fine);
        }
    }
    for (const cell of mapping.cells) {
        for (const [key, value] of Object.entries(cell)) {
            if (key !== "emitter" && key !== "pixelKey" && typeof value === "number") {
                add(value);
            }
        }
    }
    return used.size;
}

function formatNumber(value: number): string {
    return Number(value.toFixed(3)).toString().replace("-", "−");
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Summary of one capability entry, e.g. "fine: ch 2 · −265°…265°", "3 ranges", "wheel: Color 1", "default 0.5".
 * Empty when there is nothing worth showing.
 */
export function capabilitySummary(entry: CapabilityChannel | undefined, keyInfo: KeyInfo, wheels: Record<string, WheelDefinition>): string {
    const parts: string[] = [];
    const unit = UNIT_SUFFIX[keyInfo.unit] ?? "";
    const mapped = !!entry && entry.channel >= 0;
    if (!mapped) {
        if (keyInfo.segmentKind === "linear") {
            parts.push(`default ${formatNumber(entry?.defaultValue ?? keyInfo.defaultValue)}${unit}`);
        }
        return parts.join(" · ");
    }
    if (keyInfo.hasFine && entry.fine >= 0) {
        parts.push(`fine: ch ${entry.fine + 1}`);
    }
    if (keyInfo.segmentKind) {
        const segments = entry.segments;
        if (segments.length === 1 && segments[0].kind === "linear") {
            parts.push(`${formatNumber(segments[0].start)}${unit}…${formatNumber(segments[0].end)}${unit}`);
        } else if (segments.length === 0 && keyInfo.defaultRange && keyInfo.segmentKind === "linear") {
            parts.push(`${formatNumber(keyInfo.defaultRange[0])}${unit}…${formatNumber(keyInfo.defaultRange[1])}${unit}`);
        } else if (segments.length > 0) {
            parts.push(plural(segments.length, "range"));
        }
    }
    if (entry.wheel && wheels[entry.wheel]) {
        parts.push(`wheel: ${entry.wheel}`);
    }
    return parts.join(" · ");
}
