/**
 * Capability keys per visualization type, editor groups and per-key defaults (data-model.md §1).
 * No Vue/Pinia imports: shared by the main window and the show window.
 */

import type { VisualizationType } from "@/visualization/fixtureVisualization";
import type { CapabilityKey, CapabilitySegment } from "./types";

const BEAM_KEYS_WITHOUT_POSITION: CapabilityKey[] = [
    "dimmer",
    "shutter",
    "red",
    "green",
    "blue",
    "white",
    "amber",
    "uv",
    "lime",
    "indigo",
    "warmWhite",
    "coldWhite",
    "cyan",
    "magenta",
    "yellow",
    "colorTemperature",
    "colorMacro",
    "colorWheel",
    "colorWheelRotation",
    "zoom",
    "focus",
    "goboWheel",
    "goboWheelRotation",
    "goboRotation",
    "prism",
    "prismRotation",
];

/**
 * Keys each visualization type supports ("Keys by visualization type" table). Keyed by the enum's string values
 * so this module needs only a type-only import of `VisualizationType`.
 */
export const KEYS_BY_TYPE: Record<VisualizationType, CapabilityKey[]> = {
    "Moving Head": ["pan", "tilt", "panTiltSpeed", ...BEAM_KEYS_WITHOUT_POSITION],
    Spot: [...BEAM_KEYS_WITHOUT_POSITION],
    "Generic Fixture": [
        "dimmer",
        "shutter",
        "red",
        "green",
        "blue",
        "white",
        "amber",
        "uv",
        "lime",
        "indigo",
        "warmWhite",
        "coldWhite",
        "colorTemperature",
        "colorMacro",
    ],
    Laser: [
        "dimmer",
        "shutter",
        "red",
        "green",
        "blue",
        "colorMacro",
        "laserPattern",
        "laserSize",
        "laserRotation",
        "laserX",
        "laserY",
        "laserSpeed",
        "pan",
        "tilt",
    ],
    Flame: ["trigger", "height"],
    "Cold Spark": ["trigger", "height"],
    "CO2 Jet": ["trigger"],
    "Fog / Haze": ["fogOutput"],
    // No DMX mapping: LED strip colors come per pixel.
    "Led Strip": [],
};

export interface KeyGroup {
    label: "Position" | "Intensity" | "Color" | "Beam" | "Effect";
    keys: CapabilityKey[];
}

/** Editor groups. Every key appears in exactly one group; filter by `KEYS_BY_TYPE[type]` before display. */
export const KEY_GROUPS: KeyGroup[] = [
    { label: "Position", keys: ["pan", "tilt", "panTiltSpeed"] },
    { label: "Intensity", keys: ["dimmer", "shutter"] },
    {
        label: "Color",
        keys: [
            "red",
            "green",
            "blue",
            "white",
            "amber",
            "uv",
            "lime",
            "indigo",
            "warmWhite",
            "coldWhite",
            "cyan",
            "magenta",
            "yellow",
            "colorTemperature",
            "colorMacro",
            "colorWheel",
            "colorWheelRotation",
        ],
    },
    {
        label: "Beam",
        keys: ["zoom", "focus", "goboWheel", "goboWheelRotation", "goboRotation", "prism", "prismRotation"],
    },
    {
        label: "Effect",
        keys: [
            "trigger",
            "height",
            "laserPattern",
            "laserSize",
            "laserRotation",
            "laserX",
            "laserY",
            "laserSpeed",
            "fogOutput",
        ],
    },
];

export type KeyUnit = "deg" | "ratio" | "K" | "rps" | "facets" | "slot" | "gate" | "pattern" | "onoff";

export interface KeyInfo {
    label: string;
    unit: KeyUnit;
    /** Decoded value while the key is unmapped (FR-003). */
    defaultValue: number;
    /** Range of the implicit linear segment 0…255 when the segment list is empty; null = segments only. */
    defaultRange: [number, number] | null;
    /** Segment kind the editor offers for this key; null = no segment table. */
    segmentKind: CapabilitySegment["kind"] | null;
    /** Whether the editor offers a 16-bit fine channel. */
    hasFine: boolean;
}

function info(
    label: string,
    unit: KeyUnit,
    defaultValue: number,
    defaultRange: [number, number] | null,
    segmentKind: CapabilitySegment["kind"] | null,
    hasFine = false
): KeyInfo {
    return { label, unit, defaultValue, defaultRange, segmentKind, hasFine };
}

const color = (label: string) => info(label, "ratio", 0, [0, 1], "linear");
const rotation = (label: string) => info(label, "rps", 0, [-1, 1], "rotation");

/**
 * Per-key defaults ("Defaults when unmapped" table).
 * - `shutter` uses the gate unit: 1 = open (default), 0 = closed.
 * - `trigger` decodes linearly to 0…1 and is on at ≥ 0.5, which equals DMX ≥ 128 (> 50 %). Default off.
 * - `zoom` defaults to 15°; beam renderers use `BeamVisualizationConfig.defaultBeamAngle` instead.
 * - `colorTemperature` defaults to 6500 K (neutral); `pan`/`tilt` ranges are replaced by model limits when known.
 * - `colorWheel`/`goboWheel` default to slot 1 (usually open); `laserPattern` 0 means "use `options.pattern`".
 */
export const KEY_INFO: Record<CapabilityKey, KeyInfo> = {
    pan: info("Pan", "deg", 0, [-270, 270], "linear", true),
    tilt: info("Tilt", "deg", 0, [-135, 135], "linear", true),
    panTiltSpeed: info("Pan/Tilt Speed", "ratio", 0, [0, 1], "linear"),
    dimmer: info("Dimmer", "ratio", 1, [0, 1], "linear", true),
    shutter: info("Shutter / Strobe", "gate", 1, null, "shutter"),
    red: color("Red"),
    green: color("Green"),
    blue: color("Blue"),
    white: color("White"),
    amber: color("Amber"),
    uv: color("UV"),
    lime: color("Lime"),
    indigo: color("Indigo"),
    warmWhite: color("Warm White"),
    coldWhite: color("Cold White"),
    cyan: color("Cyan"),
    magenta: color("Magenta"),
    yellow: color("Yellow"),
    colorTemperature: info("Color Temperature", "K", 6500, [2700, 8000], "linear"),
    colorMacro: info("Color Macro", "slot", 0, null, "color"),
    colorWheel: info("Color Wheel", "slot", 1, null, "wheelSlot"),
    colorWheelRotation: rotation("Color Wheel Rotation"),
    zoom: info("Zoom", "deg", 15, [10, 45], "linear", true),
    // feature 004 (research R1): programming only, renderers ignore it. 0 = near, 1 = far.
    focus: info("Focus", "ratio", 0.5, [0, 1], "linear"),
    goboWheel: info("Gobo Wheel", "slot", 1, null, "wheelSlot"),
    goboWheelRotation: rotation("Gobo Wheel Rotation"),
    goboRotation: rotation("Gobo Rotation"),
    prism: info("Prism", "facets", 0, null, "linear"),
    prismRotation: rotation("Prism Rotation"),
    trigger: info("Trigger", "onoff", 0, [0, 1], "linear"),
    height: info("Height", "ratio", 1, [0, 1], "linear"),
    laserPattern: info("Laser Pattern", "pattern", 0, null, "pattern"),
    laserSize: info("Laser Size", "ratio", 0.5, [0, 1], "linear"),
    laserRotation: rotation("Laser Rotation"),
    laserX: info("Laser X", "ratio", 0, [-1, 1], "linear"),
    laserY: info("Laser Y", "ratio", 0, [-1, 1], "linear"),
    laserSpeed: info("Laser Speed", "ratio", 0.5, [0, 1], "linear"),
    fogOutput: info("Fog Output", "ratio", 0, [0, 1], "linear"),
};
