import { watchEffect } from "vue";
import { CalculateFunction, Node, NodeInterface } from "baklavajs";
import { ATTRIBUTE_KEYS, ATTRIBUTES, BUILT_IN_DEFAULTS, type AttributeKey, type AttributeValues, type ShutterValue } from "@/programming/attributes";
import { AttributeInputInterface, type AttributeInputState } from "@/graph/interfaces/AttributeInputInterface";
import { SelectTargetInterface } from "@/graph/interfaces/SelectTargetInterface";
import { getProfile } from "@/programming/profile";
import { decodeTarget, resolveTarget } from "@/programming/targets";
import type { Color } from "@/graph/colors";

type Inputs = { target: string } & Record<AttributeKey, AttributeInputState | number | Color>;

interface Outputs {
    attributeTarget: string;
    attributes: AttributeValues;
}

const NODE_TYPE = "Attribute Output";

function initialValue(key: AttributeKey): AttributeInputState["value"] {
    if (key === "color") {
        return [255, 255, 255];
    }
    if (key === "shutter") {
        return { mode: "open", rate: 10 };
    }
    return BUILT_IN_DEFAULTS[key] as number;
}

/**
 * Attribute Output (feature 004, FR-007, contracts/programming-ui.md): sets semantic attributes on the node's target
 * (the clip target, a group or a fixture). Disabled, unconnected inputs stay unset; connecting an input enables it.
 * The processor resolves the target and merges the values per attribute (R4).
 */
export class AttributeOutputNode extends Node<Inputs, Outputs> {
    public type = NODE_TYPE;
    public _title = NODE_TYPE;

    public inputs = {
        target: new SelectTargetInterface(),
        ...(Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, new AttributeInputInterface(key, ATTRIBUTES[key].label, initialValue(key))])) as Record<
            AttributeKey,
            AttributeInputInterface
        >),
    } as unknown as Record<keyof Inputs, NodeInterface>;

    public outputs = {
        attributeTarget: new NodeInterface<string>("Target", "").setHidden(true),
        attributes: new NodeInterface<AttributeValues>("Attributes", {}).setHidden(true),
    };

    private unwatch?: () => void;

    public constructor() {
        super();
        this.initializeIo();
        // slot names, pan/tilt hint and missing-target state follow the target (contracts/programming-ui.md)
        this.unwatch = watchEffect(() => this.updateHints());
    }

    public override onDestroy() {
        this.unwatch?.();
        (this.inputs.target as SelectTargetInterface).destroy();
    }

    private attributeInput(key: AttributeKey): AttributeInputInterface {
        return this.inputs[key] as unknown as AttributeInputInterface;
    }

    private updateHints() {
        const value = (this.inputs.target as SelectTargetInterface).value;
        const target = value === "clip" ? null : decodeTarget(value);
        const resolved = target ? resolveTarget(target) : null;
        const first = resolved?.fixtures[0];
        const profile = first ? getProfile(first.fixtureId) : null;
        const normalized = !!resolved?.fixtures.some((f) => getProfile(f.fixtureId)?.panTiltNormalized);
        for (const key of ATTRIBUTE_KEYS) {
            const intf = this.attributeInput(key);
            intf.slots = key === "colorWheel" || key === "goboWheel" || key === "prism" || key === "colorMacro" ? (profile?.slots[key] ?? []) : [];
            intf.hint = (key === "pan" || key === "tilt") && normalized ? "(0–1, no angle range)" : "";
        }
        const missing = !!target && (!resolved || resolved.warnings.some((w) => w.endsWith("not found")));
        this.title = missing ? `${NODE_TYPE} – Target not found` : NODE_TYPE;
    }

    public calculate: CalculateFunction<Inputs, Outputs> = (inputs) => {
        const attributes: AttributeValues = {};
        const set = <K extends AttributeKey>(key: K, value: AttributeValues[K]) => {
            (attributes as Record<AttributeKey, unknown>)[key] = value;
        };
        for (const key of ATTRIBUTE_KEYS) {
            const raw = inputs[key] as unknown;
            const connected = this.attributeInput(key).connectionCount > 0;
            const state: AttributeInputState | null = connected
                ? { enabled: true, value: raw as AttributeInputState["value"] }
                : typeof raw === "object" && raw !== null && "enabled" in raw
                  ? (raw as AttributeInputState)
                  : null;
            if (!state || !state.enabled) {
                continue;
            }
            const v = state.value;
            if (key === "color") {
                const c = Array.isArray(v) ? (v as Color) : null;
                if (c) {
                    set("color", [c[0] / 255, c[1] / 255, c[2] / 255].map((x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0))) as [number, number, number]);
                }
            } else if (key === "shutter") {
                if (typeof v === "number") {
                    // a connected number is a strobe rate; 0 = open
                    set("shutter", v > 0 ? { mode: "strobe", rate: v } : { mode: "open", rate: 0 });
                } else if (typeof v === "object" && v !== null && "mode" in v) {
                    set("shutter", { ...(v as ShutterValue) });
                }
            } else if (typeof v === "number" && Number.isFinite(v)) {
                set(key, (ATTRIBUTES[key].kind === "discrete" ? Math.round(v) : v) as never);
            }
        }
        return { attributeTarget: (inputs.target as string) || "clip", attributes };
    };
}
