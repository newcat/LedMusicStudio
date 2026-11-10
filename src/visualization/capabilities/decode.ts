/**
 * Raw DMX reading and scalar decoding of capability channels (research R1/R2, data-model.md §1).
 * Pure functions, no Vue/Pinia imports: used by every view per frame.
 */

import { KEY_INFO } from "./keys";
import type {
    CapabilityChannel,
    CapabilityKey,
    CapabilityMapping,
    CapabilitySegment,
    ResolvedChannel,
} from "./types";

/** Key of a `null` mode channel (same placeholder as `DmxFixture.channelNames`). */
const UNUSED_CHANNEL_KEY = "(unused)";

function isValidIndex(index: number, length: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < length;
}

/**
 * Raw value of a channel: 0…255 for 8-bit, `coarse·256 + fine` (0…65535) when `fine >= 0`.
 * Returns null when the coarse channel is unmapped or outside the value array (fixture mode changed).
 * A fine index outside the array reads as fine = 0, so the value stays on the 16-bit scale.
 */
export function readDmx(entry: CapabilityChannel, values: Uint8Array): number | null {
    if (!isValidIndex(entry.channel, values.length)) {
        return null;
    }
    const coarse = values[entry.channel];
    if (entry.fine < 0) {
        return coarse;
    }
    const fine = isValidIndex(entry.fine, values.length) ? values[entry.fine] : 0;
    return coarse * 256 + fine;
}

function is16Bit(entry: CapabilityChannel): boolean {
    return entry.fine >= 0;
}

/**
 * Span of a segment on the raw scale. 8-bit bounds are scaled ×257 for 16-bit raws; the upper bound extends to
 * the last 16-bit value below the next 8-bit step (`(to + 1)·257 − 1`), so adjacent segments leave no gaps.
 */
function rawSpan(segment: CapabilitySegment, sixteenBit: boolean): { from: number; to: number; matchTo: number } {
    if (!sixteenBit) {
        return { from: segment.from, to: segment.to, matchTo: segment.to };
    }
    return {
        from: segment.from * 257,
        to: segment.to * 257,
        matchTo: Math.min(65535, segment.to * 257 + 256),
    };
}

/** Segment containing `raw` (from `readDmx`), or null if none matches (callers hold their previous value). */
export function findSegment(entry: CapabilityChannel, raw: number): CapabilitySegment | null {
    const sixteenBit = is16Bit(entry);
    for (const segment of entry.segments) {
        const span = rawSpan(segment, sixteenBit);
        if (raw >= span.from && raw <= span.matchTo) {
            return segment;
        }
    }
    return null;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Position of `raw` inside the segment, 0…1 (clamped; a single-value segment gives 0). */
function segmentT(segment: CapabilitySegment, raw: number, sixteenBit: boolean): number {
    const span = rawSpan(segment, sixteenBit);
    if (span.to <= span.from) {
        return 0;
    }
    return Math.min(1, Math.max(0, (raw - span.from) / (span.to - span.from)));
}

/**
 * Decoded scalar of a linear, angle or rotation key.
 * - `entry` undefined → `fallback`.
 * - Unmapped (channel −1 or out of range) → `entry.defaultValue`.
 * - Empty segment list → one implicit linear segment 0…255 → `KEY_INFO[key].defaultRange` (0…1 without a key).
 * - No matching segment, or a segment without a scalar meaning → `fallback` (callers pass their previous value).
 */
export function decodeScalar(
    entry: CapabilityChannel | undefined,
    values: Uint8Array,
    fallback: number,
    key?: CapabilityKey
): number {
    if (!entry) {
        return fallback;
    }
    const raw = readDmx(entry, values);
    if (raw === null) {
        return entry.defaultValue;
    }
    const sixteenBit = is16Bit(entry);

    if (entry.segments.length === 0) {
        const [start, end] = (key && KEY_INFO[key].defaultRange) || [0, 1];
        return lerp(start, end, raw / (sixteenBit ? 65535 : 255));
    }

    const segment = findSegment(entry, raw);
    if (!segment) {
        return fallback;
    }
    const t = segmentT(segment, raw, sixteenBit);
    switch (segment.kind) {
        case "linear":
        case "angle":
            return lerp(segment.start, segment.end, t);
        case "rotation":
            return lerp(segment.speedStart, segment.speedEnd, t);
        default:
            return fallback;
    }
}

/**
 * Channels of the current mode that no mapping entry (coarse or fine) or cell references, in DMX order.
 * `null` mode channels ("(unused)") have no function and are never listed.
 */
export function unmappedChannels(mapping: CapabilityMapping, channels: ResolvedChannel[]): ResolvedChannel[] {
    const referenced = new Set<number>();
    for (const entry of Object.values(mapping.channels)) {
        if (!entry) {
            continue;
        }
        if (entry.channel >= 0) {
            referenced.add(entry.channel);
        }
        if (entry.fine >= 0) {
            referenced.add(entry.fine);
        }
    }
    for (const cell of mapping.cells) {
        for (const index of [cell.dimmer, cell.red, cell.green, cell.blue, cell.white, cell.amber, cell.uv]) {
            if (index >= 0) {
                referenced.add(index);
            }
        }
    }
    return channels.filter((c) => c.key !== UNUSED_CHANNEL_KEY && !referenced.has(c.index));
}
