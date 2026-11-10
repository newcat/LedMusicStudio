/**
 * OFL definition helpers for the capability mapping (feature 003, research R2/R3/R9).
 *
 * - `resolveModeChannels`: the channels of a mode in DMX order (null channels, fine aliases, matrix inserts,
 *   switching channels).
 * - Entity parsers: OFL entity strings ("-270deg", "10Hz", "warm", "50%", ...) to numbers.
 * - `goboImageOf`: embedded gobo SVG of a wheel slot.
 *
 * Shared by the main window and the show window: imports only types.
 */

import type {
    Capability as OflCapability,
    Channel as OflChannel,
    Fixture as OflFixture,
    WheelSlot as OflWheelSlot,
} from "@/stage/fixtures/dmx/open-fixture";
import type { OflMode, ResolvedChannel } from "./types";

// ---------------------------------------------------------------------------------------------------------------
// Mode channels
// ---------------------------------------------------------------------------------------------------------------

/** Placeholder key of a `null` mode channel (same as `DmxFixture.channelNames`). */
export const UNUSED_CHANNEL_KEY = "(unused)";

/** A resolved channel. `ignored` marks the third byte of a 24-bit channel (treated as 16-bit, research R3). */
export interface OflResolvedChannel extends ResolvedChannel {
    ignored?: boolean;
}

type ResolvedCapability = ResolvedChannel["capabilities"][number];
type ModeChannel = OflMode["channels"][number];
type MatrixInsert = Exclude<ModeChannel, string | null>;

const PIXEL_KEY = "$pixelKey";

/** Where a channel key comes from: a channel definition and the byte it carries (0 = coarse, 1 = fine, 2 = 24-bit). */
interface ChannelSource {
    channel: OflChannel;
    /** Key of the coarse channel (with `$pixelKey` replaced for template channels). */
    coarseKey: string;
    byte: number;
}

/** A template key pattern ("Red $pixelKey", "Tilt $pixelKey fine") with a regex that captures the pixel key. */
interface TemplatePattern {
    template: string;
    coarseTemplate: string;
    byte: number;
    regex: RegExp;
    literalLength: number;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function templatePattern(template: string, coarseTemplate: string, byte: number): TemplatePattern {
    const parts = template.split(PIXEL_KEY);
    return {
        template,
        coarseTemplate,
        byte,
        regex: new RegExp("^" + parts.map(escapeRegex).join("(.+)") + "$"),
        literalLength: parts.join("").length,
    };
}

/** Bytes per value of a channel: explicit `dmxValueResolution`, else 1 + number of fine aliases (OFL default). */
function channelBytes(channel: OflChannel): number {
    switch (channel.dmxValueResolution) {
        case "8bit":
            return 1;
        case "16bit":
            return 2;
        case "24bit":
            return 3;
        default:
            return Math.min(3, 1 + (channel.fineChannelAliases?.length ?? 0));
    }
}

/**
 * Capability list of a channel with `dmxRange` on every entry. Ranges are normalized to 8-bit (0..255), because
 * OFL writes them in the channel's resolution (e.g. 0..65535 for a 16-bit pan) and segments are 8-bit.
 * A single `capability` covers the whole range 0..255.
 */
function channelCapabilities(channel: OflChannel): ResolvedCapability[] {
    const divisor = 256 ** (channelBytes(channel) - 1);
    const list: OflCapability[] = channel.capabilities ?? (channel.capability ? [channel.capability] : []);
    return list.map((cap) => {
        const range = (cap as { dmxRange?: [number, number] }).dmxRange;
        const dmxRange: [number, number] =
            range && channel.capabilities
                ? [Math.floor(range[0] / divisor), Math.floor(range[1] / divisor)]
                : [0, 255];
        return { ...(cap as Record<string, unknown> & { type: string }), dmxRange };
    });
}

/** Natural ("Pixel 2" < "Pixel 10") string compare, used for `eachPixelABC`. */
function naturalCompare(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Pixel keys with their X/Y/Z position. `matrix.pixelKeys` is [z][y][x]; `pixelCount` gives keys "1".."n". */
function matrixPixels(definition: OflFixture): Array<{ key: string; x: number; y: number; z: number }> {
    const matrix = definition.matrix;
    if (!matrix) {
        return [];
    }
    const pixels: Array<{ key: string; x: number; y: number; z: number }> = [];
    if (matrix.pixelKeys) {
        matrix.pixelKeys.forEach((plane, z) =>
            plane.forEach((row, y) =>
                row.forEach((key, x) => {
                    if (key !== null) {
                        pixels.push({ key, x, y, z });
                    }
                })
            )
        );
    } else if (matrix.pixelCount) {
        // Numeric keys like DmxFixture.channelNames: 1..n, numbered X first, then Y, then Z.
        const [cx, cy, cz] = matrix.pixelCount;
        for (let z = 0; z < cz; z++) {
            for (let y = 0; y < cy; y++) {
                for (let x = 0; x < cx; x++) {
                    pixels.push({ key: String(1 + x + y * cx + z * cx * cy), x, y, z });
                }
            }
        }
    }
    return pixels;
}

/** Keys an insert repeats for, in DMX order. */
function repeatKeys(definition: OflFixture, repeatFor: MatrixInsert["repeatFor"]): string[] {
    if (Array.isArray(repeatFor)) {
        return [...repeatFor];
    }
    if (repeatFor === "eachPixelGroup") {
        return Object.keys(definition.matrix?.pixelGroups ?? {});
    }
    const pixels = matrixPixels(definition);
    if (repeatFor === "eachPixelABC") {
        return pixels.map((p) => p.key).sort(naturalCompare);
    }
    // "eachPixelXYZ": X changes fastest, then Y, then Z. The letters name the axes from fastest to slowest.
    const order = repeatFor.slice("eachPixel".length).toLowerCase().split("") as Array<"x" | "y" | "z">;
    const [fast, mid, slow] = order;
    return pixels
        .slice()
        .sort((a, b) => a[slow] - b[slow] || a[mid] - b[mid] || a[fast] - b[fast])
        .map((p) => p.key);
}

/** Mode channel keys in DMX order; matrix inserts expanded (`null` = unused channel). */
function expandModeChannels(definition: OflFixture, mode: OflMode): Array<{ key: string | null; pixelKey?: string; template?: string }> {
    const out: Array<{ key: string | null; pixelKey?: string; template?: string }> = [];
    for (const channel of mode.channels) {
        if (channel === null || typeof channel === "string") {
            out.push({ key: channel });
            continue;
        }
        const keys = repeatKeys(definition, channel.repeatFor);
        const templates = channel.templateChannels;
        const push = (template: string | null, pixelKey: string) =>
            out.push(
                template === null
                    ? { key: null }
                    : { key: template.replaceAll(PIXEL_KEY, pixelKey), pixelKey, template }
            );
        if (channel.channelOrder === "perChannel") {
            for (const template of templates) {
                for (const pixelKey of keys) {
                    push(template, pixelKey);
                }
            }
        } else {
            for (const pixelKey of keys) {
                for (const template of templates) {
                    push(template, pixelKey);
                }
            }
        }
    }
    return out;
}

/** Looks up channel keys in a definition: available channels, their fine aliases, templates, switching channels. */
class ChannelLookup {
    private readonly available: Record<string, OflChannel>;
    private readonly templates: Record<string, OflChannel>;
    private readonly availableAliases = new Map<string, { coarseKey: string; byte: number }>();
    private readonly templatePatterns: TemplatePattern[] = [];
    private readonly templatesByPattern = new Map<string, TemplatePattern>();
    private readonly knownPixelKeys: Set<string>;

    public constructor(definition: OflFixture) {
        this.available = definition.availableChannels ?? {};
        this.templates = definition.templateChannels ?? {};

        for (const [key, channel] of Object.entries(this.available)) {
            channel.fineChannelAliases?.forEach((alias, i) => {
                this.availableAliases.set(alias, { coarseKey: key, byte: i + 1 });
            });
        }
        for (const [key, channel] of Object.entries(this.templates)) {
            const patterns = [
                templatePattern(key, key, 0),
                ...(channel.fineChannelAliases ?? []).map((alias, i) => templatePattern(alias, key, i + 1)),
            ];
            for (const p of patterns) {
                this.templatePatterns.push(p);
                this.templatesByPattern.set(p.template, p);
            }
        }
        // More specific patterns first ("Tilt $pixelKey fine" before "Tilt $pixelKey").
        this.templatePatterns.sort((a, b) => b.literalLength - a.literalLength);

        this.knownPixelKeys = new Set([
            ...matrixPixels(definition).map((p) => p.key),
            ...Object.keys(definition.matrix?.pixelGroups ?? {}),
        ]);
    }

    /** A channel expanded from a matrix insert: the template and pixel key are known. */
    public fromTemplate(template: string, pixelKey: string): ChannelSource | null {
        const pattern = this.templatesByPattern.get(template);
        if (!pattern) {
            return null;
        }
        return {
            channel: this.templates[pattern.coarseTemplate],
            coarseKey: pattern.coarseTemplate.replaceAll(PIXEL_KEY, pixelKey),
            byte: pattern.byte,
        };
    }

    public find(key: string): ChannelSource | null {
        return this.findDirect(key) ?? this.findSwitched(key);
    }

    private findDirect(key: string): ChannelSource | null {
        if (Object.prototype.hasOwnProperty.call(this.available, key)) {
            return { channel: this.available[key], coarseKey: key, byte: 0 };
        }
        const alias = this.availableAliases.get(key);
        if (alias) {
            return { channel: this.available[alias.coarseKey], coarseKey: alias.coarseKey, byte: alias.byte };
        }
        return this.findTemplate(key);
    }

    /** Template channel referenced by its resolved name ("Red Master"). Known pixel keys are preferred. */
    private findTemplate(key: string): ChannelSource | null {
        let fallback: ChannelSource | null = null;
        for (const pattern of this.templatePatterns) {
            const match = pattern.regex.exec(key);
            if (!match) {
                continue;
            }
            const pixelKey = match[1] ?? "";
            const source: ChannelSource = {
                channel: this.templates[pattern.coarseTemplate],
                coarseKey: pattern.coarseTemplate.replaceAll(PIXEL_KEY, pixelKey),
                byte: pattern.byte,
            };
            if (this.knownPixelKeys.has(pixelKey) || !pattern.template.includes(PIXEL_KEY)) {
                return source;
            }
            fallback ??= source;
        }
        return fallback;
    }

    /**
     * Switching channel alias (`switchChannels`): not supported, the default channel is used. That is the target
     * of the trigger channel's capability at its `defaultValue`, else of the first capability naming the alias.
     */
    private findSwitched(key: string): ChannelSource | null {
        for (const channel of Object.values(this.available)) {
            const caps = channelCapabilities(channel).filter((cap) => {
                const switches = cap.switchChannels as Record<string, string> | undefined;
                return switches !== undefined && typeof switches[key] === "string";
            });
            if (caps.length === 0) {
                continue;
            }
            const def = typeof channel.defaultValue === "number" ? channel.defaultValue / 256 ** (channelBytes(channel) - 1) : null;
            const cap =
                (def !== null && caps.find((c) => c.dmxRange !== undefined && def >= c.dmxRange[0] && def <= c.dmxRange[1])) ||
                caps[0];
            const target = (cap.switchChannels as Record<string, string>)[key];
            return target !== key ? this.findDirect(target) : null;
        }
        return null;
    }
}

/**
 * Channels of a mode in DMX order (research R3, point 1):
 * - `null` → key "(unused)", no capabilities.
 * - String keys: `availableChannels`, their fine aliases, then `templateChannels` (matching `$pixelKey`), then
 *   switching channel aliases (default channel).
 * - Fine aliases get `fineOf` = index of the coarse channel and no capabilities. The third byte of a 24-bit
 *   channel gets `ignored: true` (no `fineOf`).
 * - Matrix inserts expand like `DmxFixture.channelNames` and set `pixelKey`.
 * - Capability `dmxRange`s are 8-bit (see `channelCapabilities`). Unknown keys get no capabilities.
 */
export function resolveModeChannels(definition: OflFixture, mode: OflMode): OflResolvedChannel[] {
    const lookup = new ChannelLookup(definition);
    const expanded = expandModeChannels(definition, mode);

    const sources: Array<ChannelSource | null> = [];
    const result: OflResolvedChannel[] = expanded.map((entry, index) => {
        if (entry.key === null) {
            sources.push(null);
            return { index, key: UNUSED_CHANNEL_KEY, capabilities: [] };
        }
        const source =
            entry.template !== undefined && entry.pixelKey !== undefined
                ? (lookup.fromTemplate(entry.template, entry.pixelKey) ?? lookup.find(entry.key))
                : lookup.find(entry.key);
        sources.push(source);
        const resolved: OflResolvedChannel = {
            index,
            key: entry.key,
            capabilities: source && source.byte === 0 ? channelCapabilities(source.channel) : [],
        };
        if (entry.pixelKey !== undefined) {
            resolved.pixelKey = entry.pixelKey;
        }
        return resolved;
    });

    // Link fine channels to their coarse channel (first occurrence of the coarse key in this mode).
    const indexByKey = new Map<string, number>();
    result.forEach((ch, i) => {
        if (sources[i]?.byte === 0 && !indexByKey.has(ch.key)) {
            indexByKey.set(ch.key, i);
        }
    });
    result.forEach((ch, i) => {
        const source = sources[i];
        if (!source || source.byte === 0) {
            return;
        }
        if (source.byte >= 2) {
            ch.ignored = true;
            return;
        }
        const coarse = indexByKey.get(source.coarseKey);
        if (coarse !== undefined) {
            ch.fineOf = coarse;
        }
    });

    return result;
}

// ---------------------------------------------------------------------------------------------------------------
// Entity parsers (research R3, point 3)
// ---------------------------------------------------------------------------------------------------------------

const NUMBER_WITH_UNIT = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-z%]*)\s*$/i;

function splitNumber(value: string): { n: number; unit: string } | null {
    const m = NUMBER_WITH_UNIT.exec(value);
    if (!m) {
        return null;
    }
    const n = Number(m[1]);
    return Number.isFinite(n) ? { n, unit: m[2].toLowerCase() } : null;
}

/** Angle in degrees: "-270deg" → −270, "50%" → 0.5 · physicalMax. */
export function parseAngle(value: string | undefined | null, physicalMax: number): number | null {
    if (typeof value !== "string") {
        return null;
    }
    const p = splitNumber(value);
    if (!p) {
        return null;
    }
    if (p.unit === "deg" || p.unit === "") {
        return p.n;
    }
    if (p.unit === "%") {
        return (p.n / 100) * physicalMax;
    }
    return null;
}

const SPEED_FAST_HZ = 20;
const SPEED_SLOW_HZ = 1;

/** Speed in Hz: "10Hz", "600rpm" (10 Hz), "120bpm" (2 Hz), "fast" 20, "slow" 1, "stop" 0, "50%" of fast. */
export function parseSpeedHz(value: string | undefined | null): number | null {
    if (typeof value !== "string") {
        return null;
    }
    const v = value.trim().toLowerCase();
    if (v.startsWith("fast")) {
        return SPEED_FAST_HZ;
    }
    if (v.startsWith("slow")) {
        return SPEED_SLOW_HZ;
    }
    if (v === "stop") {
        return 0;
    }
    const p = splitNumber(v);
    if (!p) {
        return null;
    }
    switch (p.unit) {
        case "hz":
            return Math.abs(p.n);
        case "khz":
            return Math.abs(p.n) * 1000;
        case "rpm":
        case "bpm":
            return Math.abs(p.n) / 60;
        case "%":
            return (Math.abs(p.n) / 100) * SPEED_FAST_HZ;
        default:
            return null;
    }
}

const ROTATION_FAST_RPS = 2;
const ROTATION_SLOW_RPS = 0.1;
const ROTATION_FULL_PERCENT_RPS = 1;

/**
 * Rotation speed in rps, negative = counter-clockwise: "10Hz", "600rpm", "fast" 2, "slow" 0.1, "stop" 0,
 * "%" → 1 rps at 100 %. "reverse"/"CCW" (or a negative number) give a negative speed.
 */
export function parseRotationRps(value: string | undefined | null): number | null {
    if (typeof value !== "string") {
        return null;
    }
    let v = value.trim().toLowerCase();
    let sign = 1;
    if (/\b(reverse|ccw)\b/.test(v)) {
        sign = -1;
        v = v.replace(/\b(reverse|ccw)\b/g, "").trim();
    }
    v = v.replace(/\bcw\b/g, "").trim();
    if (v.startsWith("fast")) {
        return sign * ROTATION_FAST_RPS;
    }
    if (v.startsWith("slow")) {
        return sign * ROTATION_SLOW_RPS;
    }
    if (v === "stop") {
        return 0;
    }
    const p = splitNumber(v);
    if (!p) {
        return null;
    }
    switch (p.unit) {
        case "hz":
            return sign * p.n;
        case "rpm":
        case "bpm":
            return (sign * p.n) / 60;
        case "%":
            return (sign * p.n * ROTATION_FULL_PERCENT_RPS) / 100;
        default:
            return null;
    }
}

/** Color temperature in K: "3200K", "warm" 3000, "CTO" 3200, "default" 6500, "cold"/"CTB" 8000. */
export function parseKelvin(value: string | undefined | null): number | null {
    if (typeof value !== "string") {
        return null;
    }
    const v = value.trim().toLowerCase();
    switch (v) {
        case "warm":
            return 3000;
        case "cto":
            return 3200;
        case "default":
            return 6500;
        case "cold":
        case "ctb":
            return 8000;
    }
    const p = splitNumber(v);
    return p && p.unit === "k" ? p.n : null;
}

/** Brightness 0..1: "off" 0, "dark" 0.2, "bright" 1, "50%" 0.5. Other units (lm) give null. */
export function parseBrightness(value: string | undefined | null): number | null {
    if (typeof value !== "string") {
        return null;
    }
    const v = value.trim().toLowerCase();
    switch (v) {
        case "off":
            return 0;
        case "dark":
            return 0.2;
        case "bright":
            return 1;
    }
    const p = splitNumber(v);
    return p && p.unit === "%" ? p.n / 100 : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Gobo images (research R9)
// ---------------------------------------------------------------------------------------------------------------

/** Largest embedded gobo SVG that is kept in the config. */
export const MAX_GOBO_SVG_LENGTH = 32 * 1024;

/** The export's embedded resource form. The generated schema types `resource` as a string reference. */
interface EmbeddedResource {
    image: { mimeType: string; data: string; encoding?: string };
}

function isEmbeddedResource(resource: unknown): resource is EmbeddedResource {
    if (typeof resource !== "object" || resource === null) {
        return false;
    }
    const image = (resource as { image?: unknown }).image;
    return (
        typeof image === "object" &&
        image !== null &&
        typeof (image as { mimeType?: unknown }).mimeType === "string" &&
        typeof (image as { data?: unknown }).data === "string"
    );
}

/**
 * Embedded SVG markup of a gobo slot, or null: accepts the export's object form `resource: { image: { mimeType,
 * data } }` when the mimeType starts with `image/svg+xml` and the markup is at most 32 KB. The schema's string
 * form (a resource reference), other formats and larger images return null (generic pattern fallback).
 */
export function goboImageOf(slot: OflWheelSlot): string | null {
    if (slot.type !== "Gobo") {
        return null;
    }
    const resource: unknown = slot.resource;
    if (!isEmbeddedResource(resource)) {
        return null;
    }
    const { mimeType, encoding } = resource.image;
    let data = resource.image.data;
    if (!mimeType.toLowerCase().startsWith("image/svg+xml")) {
        return null;
    }
    if (encoding === "base64") {
        try {
            data = atob(data);
        } catch {
            return null;
        }
    }
    return data.length <= MAX_GOBO_SVG_LENGTH ? data : null;
}
