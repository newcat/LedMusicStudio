/**
 * Mapping repair on load (data-model.md §8, rule 6). Pure functions, no Vue/Pinia imports.
 *
 * - Keys the visualization type does not support are dropped.
 * - Segment lists are sorted, clipped to 0…255 and stripped of overlaps; invalid segments are dropped.
 * - `wheel` references to missing wheels are removed (the entry is kept; its slots then decode as open).
 * - Cells are kept only for Generic Fixture.
 */

import type { VisualizationType } from "@/visualization/fixtureVisualization";
import { KEY_INFO, KEYS_BY_TYPE } from "./keys";
import type {
    CapabilityChannel,
    CapabilityKey,
    CapabilityMapping,
    CapabilitySegment,
    CellMapping,
    LaserPattern,
    ShutterEffect,
    WheelDefinition,
    WheelSlot,
} from "./types";
import { emptyMapping } from "./types";

type Rec = Record<string, unknown>;

export interface SanitizeMappingResult {
    mapping: CapabilityMapping;
    /** True if anything had to be dropped or fixed (the caller reports a problem for the object). */
    repaired: boolean;
}

const SHUTTER_EFFECTS: readonly ShutterEffect[] = ["open", "closed", "strobe", "pulse", "rampUp", "rampDown", "rampUpDown", "random"];
const LASER_PATTERNS: readonly LaserPattern[] = ["beam", "fan", "cone", "sheet", "dots"];
const GENERIC_FIXTURE: VisualizationType = "Generic Fixture" as VisualizationType;

function isRec(v: unknown): v is Rec {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function isIndex(v: unknown): v is number {
    return Number.isInteger(v) && (v as number) >= -1;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** A segment without its DMX bounds (distributes over the union). */
type SegmentBody = CapabilitySegment extends infer S ? (S extends CapabilitySegment ? Omit<S, "from" | "to"> : never) : never;

/** Kind-specific fields of a segment, or null if the segment is invalid. Bounds are handled by the caller. */
function segmentBody(raw: Rec): SegmentBody | null {
    switch (raw.kind) {
        case "linear":
        case "angle":
            return isNum(raw.start) && isNum(raw.end) ? { kind: raw.kind, start: raw.start, end: raw.end } : null;
        case "shutter":
            return SHUTTER_EFFECTS.includes(raw.effect as ShutterEffect)
                ? {
                      kind: "shutter",
                      effect: raw.effect as ShutterEffect,
                      rateStart: isNum(raw.rateStart) ? Math.max(0, raw.rateStart) : 0,
                      rateEnd: isNum(raw.rateEnd) ? Math.max(0, raw.rateEnd) : 0,
                  }
                : null;
        case "wheelSlot":
            return isNum(raw.slotStart) && isNum(raw.slotEnd) ? { kind: "wheelSlot", slotStart: raw.slotStart, slotEnd: raw.slotEnd } : null;
        case "rotation":
            return isNum(raw.speedStart) && isNum(raw.speedEnd)
                ? { kind: "rotation", speedStart: raw.speedStart, speedEnd: raw.speedEnd }
                : null;
        case "color": {
            const colors = Array.isArray(raw.colors) ? raw.colors.filter((c): c is string => typeof c === "string" && HEX_COLOR.test(c)) : [];
            const temperature = isNum(raw.temperature) && raw.temperature > 0 ? raw.temperature : null;
            return colors.length > 0 || temperature !== null ? { kind: "color", colors: colors.slice(0, 2), temperature } : null;
        }
        case "pattern":
            return LASER_PATTERNS.includes(raw.pattern as LaserPattern) ? { kind: "pattern", pattern: raw.pattern as LaserPattern } : null;
        case "none":
            return { kind: "none" };
        default:
            return null;
    }
}

/** Sorted by `from`, clipped to 0…255, no overlaps (a later segment starts after the previous one ends). */
export function sanitizeSegments(raw: unknown): { segments: CapabilitySegment[]; repaired: boolean } {
    if (!Array.isArray(raw)) {
        return { segments: [], repaired: raw !== undefined };
    }
    let repaired = false;
    const candidates: CapabilitySegment[] = [];
    for (const item of raw) {
        const body = isRec(item) ? segmentBody(item) : null;
        if (!body || !isRec(item) || !isNum(item.from) || !isNum(item.to)) {
            repaired = true;
            continue;
        }
        let from = Math.round(item.from);
        let to = Math.round(item.to);
        if (from > to) {
            [from, to] = [to, from];
        }
        const clippedFrom = Math.min(255, Math.max(0, from));
        const clippedTo = Math.min(255, Math.max(0, to));
        if (clippedFrom !== item.from || clippedTo !== item.to) {
            repaired = true;
        }
        if (to < 0 || from > 255) {
            // entirely outside the DMX range
            continue;
        }
        candidates.push({ ...body, from: clippedFrom, to: clippedTo } as CapabilitySegment);
    }
    // stable sort keeps the stored order of segments with equal starts
    const sorted = candidates.map((s, i) => ({ s, i })).sort((a, b) => a.s.from - b.s.from || a.i - b.i);
    if (sorted.some((entry, i) => entry.i !== i)) {
        repaired = true;
    }
    const segments: CapabilitySegment[] = [];
    for (const { s } of sorted) {
        const previous = segments[segments.length - 1];
        if (previous && s.from <= previous.to) {
            repaired = true;
            if (s.to <= previous.to) {
                continue;
            }
            s.from = previous.to + 1;
        }
        segments.push(s);
    }
    return { segments, repaired };
}

function sanitizeWheelSlot(raw: unknown): WheelSlot | null {
    if (!isRec(raw)) {
        return null;
    }
    const name = typeof raw.name === "string" ? raw.name : "";
    switch (raw.type) {
        case "open":
        case "closed":
        case "frost":
            return { type: raw.type };
        case "iris":
            return { type: "iris", open: isNum(raw.open) ? Math.min(1, Math.max(0, raw.open)) : 1 };
        case "color": {
            const colors = Array.isArray(raw.colors) ? raw.colors.filter((c): c is string => typeof c === "string" && HEX_COLOR.test(c)).slice(0, 2) : [];
            const temperature = isNum(raw.temperature) && raw.temperature > 0 ? raw.temperature : null;
            return { type: "color", name, colors: colors.length === 0 && temperature === null ? ["#ffffff"] : colors, temperature };
        }
        case "gobo":
            return { type: "gobo", name, image: typeof raw.image === "string" && raw.image.length > 0 ? raw.image : "generic:0" };
        case "prism":
            return { type: "prism", name, facets: isNum(raw.facets) ? Math.min(8, Math.max(2, Math.round(raw.facets))) : 3 };
        default:
            return null;
    }
}

function sanitizeWheels(raw: unknown): { wheels: Record<string, WheelDefinition>; repaired: boolean } {
    const wheels: Record<string, WheelDefinition> = {};
    if (!isRec(raw)) {
        return { wheels, repaired: raw !== undefined };
    }
    let repaired = false;
    for (const [name, value] of Object.entries(raw)) {
        if (!isRec(value) || !Array.isArray(value.slots)) {
            repaired = true;
            continue;
        }
        const slots: WheelSlot[] = [];
        for (const rawSlot of value.slots) {
            const slot = sanitizeWheelSlot(rawSlot);
            if (slot) {
                slots.push(slot);
            } else {
                // keep the slot numbering: an unreadable slot becomes open
                slots.push({ type: "open" });
                repaired = true;
            }
        }
        if (value.direction !== "CW" && value.direction !== "CCW") {
            repaired = true;
        }
        wheels[name] = { slots, direction: value.direction === "CCW" ? "CCW" : "CW" };
    }
    return { wheels, repaired };
}

function sanitizeChannel(
    key: CapabilityKey,
    raw: unknown,
    wheels: Record<string, WheelDefinition>
): { entry: CapabilityChannel | null; repaired: boolean } {
    if (!isRec(raw)) {
        return { entry: null, repaired: true };
    }
    let repaired = false;
    const channel = isIndex(raw.channel) ? raw.channel : -1;
    let fine = isIndex(raw.fine) ? raw.fine : -1;
    if (channel !== raw.channel || fine !== raw.fine) {
        repaired = true;
    }
    if (fine >= 0 && fine === channel) {
        fine = -1;
        repaired = true;
    }
    const { segments, repaired: segmentsRepaired } = sanitizeSegments(raw.segments);
    repaired ||= segmentsRepaired;
    const defaultValue = isNum(raw.defaultValue) ? raw.defaultValue : KEY_INFO[key].defaultValue;
    const source = raw.source === "auto" || raw.source === "manual" ? raw.source : "manual";
    if (defaultValue !== raw.defaultValue || source !== raw.source) {
        repaired = true;
    }
    const entry: CapabilityChannel = { channel, fine, segments, defaultValue, source };
    if (raw.wheel !== undefined) {
        if (typeof raw.wheel === "string" && wheels[raw.wheel]) {
            entry.wheel = raw.wheel;
        } else {
            repaired = true;
        }
    }
    return { entry, repaired };
}

function sanitizeCell(raw: unknown): CellMapping | null {
    if (!isRec(raw) || typeof raw.emitter !== "string" || typeof raw.pixelKey !== "string") {
        return null;
    }
    const index = (v: unknown) => (isIndex(v) ? v : -1);
    return {
        emitter: raw.emitter,
        pixelKey: raw.pixelKey,
        dimmer: index(raw.dimmer),
        red: index(raw.red),
        green: index(raw.green),
        blue: index(raw.blue),
        white: index(raw.white),
        amber: index(raw.amber),
        uv: index(raw.uv),
    };
}

/** Repairs a stored mapping for `type` (rule 6). Never throws; anything unreadable becomes an empty mapping. */
export function sanitizeMapping(raw: unknown, type: VisualizationType): SanitizeMappingResult {
    if (!isRec(raw)) {
        return { mapping: emptyMapping(), repaired: true };
    }
    const allowed = new Set<CapabilityKey>(KEYS_BY_TYPE[type] ?? []);
    const { wheels, repaired: wheelsRepaired } = sanitizeWheels(raw.wheels);
    let repaired = wheelsRepaired;

    const channels: CapabilityMapping["channels"] = {};
    if (isRec(raw.channels)) {
        for (const [key, value] of Object.entries(raw.channels)) {
            if (!allowed.has(key as CapabilityKey)) {
                repaired = true;
                continue;
            }
            const result = sanitizeChannel(key as CapabilityKey, value, wheels);
            repaired ||= result.repaired;
            if (result.entry) {
                channels[key as CapabilityKey] = result.entry;
            }
        }
    } else if (raw.channels !== undefined) {
        repaired = true;
    }

    const cells: CellMapping[] = [];
    if (Array.isArray(raw.cells)) {
        for (const rawCell of raw.cells) {
            const cell = type === GENERIC_FIXTURE ? sanitizeCell(rawCell) : null;
            if (cell) {
                cells.push(cell);
            } else {
                repaired = true;
            }
        }
    } else if (raw.cells !== undefined) {
        repaired = true;
    }

    const mappedMode = typeof raw.mappedMode === "string" ? raw.mappedMode : null;
    const mappedChannelCount = Number.isInteger(raw.mappedChannelCount) && (raw.mappedChannelCount as number) >= 0 ? (raw.mappedChannelCount as number) : 0;
    if ((raw.mappedMode !== undefined && mappedMode !== raw.mappedMode) || (raw.mappedChannelCount !== undefined && mappedChannelCount !== raw.mappedChannelCount)) {
        repaired = true;
    }

    return { mapping: { channels, wheels, cells, mappedMode, mappedChannelCount }, repaired };
}
