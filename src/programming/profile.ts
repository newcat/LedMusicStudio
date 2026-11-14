/**
 * Mapping resolution and fixture profiles (feature 004, research R2/R3, data-model §1).
 *
 * The mapping used for programming is the linked visualization's mapping; fixtures without a scene object get an
 * auto-generated one (type inferred: pan/tilt → Moving Head, matrix → Generic Fixture, else Spot), kept in memory
 * only. Profiles are cached per fixture and invalidated when the scene objects, fixture configs or the fixture
 * list change. Reads the stage and scene stores (main window only).
 */

import { watch } from "vue";
import { useScene } from "@/scene/sceneStore";
import { DmxFixture, FixtureType, useStage } from "@/stage";
import type { Fixture as OflFixture } from "@/stage/fixtures/dmx/open-fixture";
import type { FixtureAssetDefinition } from "@/assetLibrary/types";
import { VisualizationType } from "@/visualization/fixtureVisualization";
import { fixtureModelOf } from "@/visualization/fixtureVisualizations/defaultMapping";
import { autoMapCapabilities } from "@/visualization/capabilities/autoMap";
import { resolveModeChannels, type OflResolvedChannel } from "@/visualization/capabilities/oflResolve";
import type { CapabilityChannel, CapabilityMapping, OflMode } from "@/visualization/capabilities/types";
import {
    ATTRIBUTE_KEYS,
    BUILT_IN_DEFAULTS,
    cloneValues,
    validateAttributeValue,
    type AttributeKey,
    type AttributeValue,
    type AttributeValueMap,
    type EncodeResult,
    type FixtureProfile,
    type Range,
    type SlotAttributeKey,
    type SlotInfo,
} from "./attributes";
import { colorMacroSlotsOf, hasDimmerChannel, linearRangeOf, prismSlotsOf, rotationRangeOf, wheelSlotsOf } from "./encode";

export interface ProgrammingContext {
    fixture: DmxFixture;
    definition: OflFixture;
    mode: OflMode;
    mapping: CapabilityMapping;
    profile: FixtureProfile;
    /** Scene model of the linked visualization (aim, R11), null without scene object or model. */
    model: FixtureAssetDefinition | null;
    /** Scene object id of the linked visualization, null without scene object. */
    sceneObjectId: string | null;
    /** Reused encoder output (R12). */
    encodeBuffer: EncodeResult | null;
}

const cache = new Map<string, ProgrammingContext | null>();
let watching = false;

/** Drops all cached profiles; the next lookup rebuilds them. */
export function invalidateProfiles(): void {
    cache.clear();
}

function ensureWatchers(): void {
    if (watching) {
        return;
    }
    watching = true;
    const scene = useScene();
    const stage = useStage();
    watch(() => scene.scene.objects, invalidateProfiles, { deep: true });
    watch(
        () => Array.from(stage.fixtures.values()).map((f) => f.config),
        invalidateProfiles,
        { deep: true }
    );
    watch(() => Array.from(stage.fixtures.keys()).join(","), invalidateProfiles);
}

/** All DMX fixtures of the stage. */
export function dmxFixtures(): DmxFixture[] {
    const stage = useStage();
    return Array.from(stage.fixtures.values()).filter((f): f is DmxFixture => f.type === FixtureType.DMX);
}

/** Programming context of a DMX fixture (mapping, profile), or null if it is not a configured DMX fixture. */
export function getProgrammingContext(fixtureId: string): ProgrammingContext | null {
    ensureWatchers();
    if (cache.has(fixtureId)) {
        return cache.get(fixtureId)!;
    }
    const context = buildContext(fixtureId);
    cache.set(fixtureId, context);
    return context;
}

export function getProfile(fixtureId: string): FixtureProfile | null {
    return getProgrammingContext(fixtureId)?.profile ?? null;
}

export function resolveMapping(fixtureId: string): CapabilityMapping | null {
    return getProgrammingContext(fixtureId)?.mapping ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------------------------------------------

function inferType(definition: OflFixture, channels: OflResolvedChannel[]): VisualizationType {
    if (channels.some((c) => c.capabilities.some((cap) => cap.type === "Pan" || cap.type === "Tilt"))) {
        return VisualizationType.MOVING_HEAD;
    }
    return definition.matrix ? VisualizationType.GENERIC : VisualizationType.SPOT;
}

function buildContext(fixtureId: string): ProgrammingContext | null {
    const stage = useStage();
    const fixture = stage.fixtures.get(fixtureId);
    if (!fixture || fixture.type !== FixtureType.DMX) {
        return null;
    }
    const dmx = fixture as DmxFixture;
    const definition = dmx.config.definition;
    const mode = dmx.config.mode;
    if (!definition || !mode) {
        return null;
    }
    const channels = resolveModeChannels(definition, mode);

    const scene = useScene();
    const object = scene.findObjectByFixture(fixtureId);
    const model = object ? fixtureModelOf(object.modelId) : null;
    let mapping: CapabilityMapping | null = null;
    if (object && "mapping" in object.config && object.config.mapping) {
        mapping = object.config.mapping;
    }
    if (!mapping) {
        mapping = autoMapCapabilities(definition, mode, inferType(definition, channels), model);
    }

    const profile = buildProfile(dmx, definition, channels, mapping, model);
    return { fixture: dmx, definition, mode, mapping, profile, model, sceneObjectId: object?.id ?? null, encodeBuffer: null };
}

function mapped(entry: CapabilityChannel | undefined, channelCount: number): entry is CapabilityChannel {
    return !!entry && Number.isInteger(entry.channel) && entry.channel >= 0 && entry.channel < channelCount;
}

/** Whether the OFL capabilities of the channel give real angles for pan/tilt (else the mapping range is a guess). */
function hasAngles(channels: OflResolvedChannel[], entry: CapabilityChannel): boolean {
    const caps = channels[entry.channel]?.capabilities ?? [];
    return caps.some((c) => "angle" in c || "angleStart" in c || "angleEnd" in c);
}

function buildProfile(
    fixture: DmxFixture,
    definition: OflFixture,
    channels: OflResolvedChannel[],
    mapping: CapabilityMapping,
    model: FixtureAssetDefinition | null
): FixtureProfile {
    const n = channels.length;
    const ch = mapping.channels;
    const is = (key: keyof typeof ch) => mapped(ch[key], n);
    const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < n;

    const additive = is("red") || is("green") || is("blue");
    const cmy = is("cyan") || is("magenta") || is("yellow");
    const cells = mapping.cells.some((c) => [c.red, c.green, c.blue, c.white].some(inRange));
    const whites = is("white") || is("warmWhite") || is("coldWhite");

    const slots: Partial<Record<SlotAttributeKey, SlotInfo[]>> = {};
    if (is("colorWheel")) {
        slots.colorWheel = wheelSlotsOf(mapping, "colorWheel");
    }
    if (is("goboWheel")) {
        slots.goboWheel = wheelSlotsOf(mapping, "goboWheel");
    }
    if (is("prism")) {
        slots.prism = prismSlotsOf(mapping);
    }
    if (is("colorMacro")) {
        slots.colorMacro = colorMacroSlotsOf(mapping);
    }

    const supported = new Set<AttributeKey>();
    const add = (key: AttributeKey, condition: boolean) => condition && supported.add(key);
    add("pan", is("pan"));
    add("tilt", is("tilt"));
    add("panTiltSpeed", is("panTiltSpeed"));
    // virtual dimmer: fixtures without a dimmer channel scale their color channels
    add("dimmer", hasDimmerChannel(mapping, n) || additive || cells || whites);
    add("shutter", is("shutter") || supported.has("dimmer"));
    add("color", additive || cmy || cells || whites || (slots.colorWheel ?? []).some((s) => s.kind === "color"));
    add("colorTemperature", is("colorTemperature") || additive || cells || is("warmWhite") || is("coldWhite"));
    add("colorWheel", (slots.colorWheel ?? []).length > 0);
    add("colorMacro", (slots.colorMacro ?? []).length > 0);
    add("goboWheel", (slots.goboWheel ?? []).length > 0);
    add("goboRotation", is("goboRotation"));
    add("prism", (slots.prism ?? []).length > 0);
    add("prismRotation", is("prismRotation"));
    add("zoom", is("zoom"));
    add("focus", is("focus"));

    // pan/tilt in degrees unless neither the OFL definition nor the model gives an angle range (FR-003)
    const axisNormalized = (key: "pan" | "tilt") => {
        const entry = ch[key];
        if (!mapped(entry, n) || entry.source === "manual") {
            return false;
        }
        return !hasAngles(channels, entry) && !model?.fixture.movingParts?.[key];
    };
    const axes = (["pan", "tilt"] as const).filter((k) => is(k));
    const panTiltNormalized = axes.length > 0 && axes.every(axisNormalized);

    const ranges: Partial<Record<AttributeKey, Range>> = {
        dimmer: { min: 0, max: 1 },
        panTiltSpeed: { min: 0, max: 1 },
        zoom: { min: 0, max: 1 },
        focus: { min: 0, max: 1 },
        pan: panTiltNormalized ? { min: 0, max: 1 } : linearRangeOf(ch.pan, "pan"),
        tilt: panTiltNormalized ? { min: 0, max: 1 } : linearRangeOf(ch.tilt, "tilt"),
        colorTemperature: is("colorTemperature") ? linearRangeOf(ch.colorTemperature, "colorTemperature") : { min: 2000, max: 10000 },
        goboRotation: rotationRangeOf(ch.goboRotation, "goboRotation"),
        prismRotation: rotationRangeOf(ch.prismRotation, "prismRotation"),
    };

    const builtInDefaults = cloneValues(BUILT_IN_DEFAULTS);
    if (panTiltNormalized) {
        builtInDefaults.pan = 0.5;
        builtInDefaults.tilt = 0.5;
    }
    const temperature = ranges.colorTemperature!;
    builtInDefaults.colorTemperature = is("colorTemperature") ? Math.round((temperature.min + temperature.max) / 2) : 6500;
    const openSlot = (list: SlotInfo[] | undefined) => list?.find((s) => s.kind === "open")?.number ?? 1;
    builtInDefaults.colorWheel = openSlot(slots.colorWheel);
    builtInDefaults.goboWheel = openSlot(slots.goboWheel);

    const defaults = cloneValues(builtInDefaults);
    const overridden = new Set<AttributeKey>();
    const overrides = fixture.config.defaults ?? {};
    for (const key of ATTRIBUTE_KEYS) {
        const raw = overrides[key];
        if (raw === undefined || !supported.has(key)) {
            continue;
        }
        const slotList = key === "colorWheel" || key === "goboWheel" || key === "prism" || key === "colorMacro" ? slots[key] : undefined;
        const v = validateAttributeValue(key, raw, slotList?.length);
        if (v !== null) {
            (defaults as Record<AttributeKey, AttributeValue>)[key] = v;
            overridden.add(key);
        }
    }

    return {
        fixtureId: fixture.id,
        channelCount: n,
        supported,
        panTiltNormalized,
        ranges,
        slots,
        channelDefaults: channelDefaultsOf(definition, channels),
        builtInDefaults,
        defaults: defaults as AttributeValueMap,
        overridden,
    };
}

/** OFL `defaultValue` of every channel: numbers as is (16-bit split over coarse/fine), "x%" scaled, else 0 (FR-013). */
function channelDefaultsOf(definition: OflFixture, channels: OflResolvedChannel[]): Uint8Array {
    const result = new Uint8Array(channels.length);
    const full = new Map<number, number>();
    const sourceOf = (ch: OflResolvedChannel) => {
        const direct = definition.availableChannels?.[ch.key];
        if (direct) {
            return direct;
        }
        if (ch.pixelKey !== undefined) {
            for (const [template, channel] of Object.entries(definition.templateChannels ?? {})) {
                if (template.replaceAll("$pixelKey", ch.pixelKey) === ch.key) {
                    return channel;
                }
            }
        }
        return undefined;
    };
    channels.forEach((ch, i) => {
        if (ch.fineOf !== undefined || ch.ignored) {
            return;
        }
        const raw = sourceOf(ch)?.defaultValue;
        const hasFine = channels.some((c) => c.fineOf === i);
        let value = 0;
        if (typeof raw === "number" && Number.isFinite(raw)) {
            // 8-bit defaults on a 16-bit channel set the coarse byte only
            value = hasFine && raw <= 255 ? raw * 256 : raw;
        } else if (typeof raw === "string") {
            const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(raw);
            if (m) {
                value = (Number(m[1]) / 100) * (hasFine ? 65535 : 255);
            }
        }
        value = Math.round(Math.max(0, Math.min(hasFine ? 65535 : 255, value)));
        if (hasFine) {
            full.set(i, value);
            result[i] = value >> 8;
        } else {
            result[i] = value;
        }
    });
    channels.forEach((ch, i) => {
        if (ch.fineOf !== undefined) {
            result[i] = (full.get(ch.fineOf) ?? 0) & 255;
        }
    });
    return result;
}

/** Profiles of fixtures for editors (slot names, ranges), labeled with the fixture model. */
export function profileOptions(fixtureIds: Iterable<string>): Array<{ profile: FixtureProfile; label: string }> {
    const result: Array<{ profile: FixtureProfile; label: string }> = [];
    for (const id of fixtureIds) {
        const context = getProgrammingContext(id);
        if (context) {
            result.push({ profile: context.profile, label: context.definition.name ?? context.fixture.name });
        }
    }
    return result;
}
