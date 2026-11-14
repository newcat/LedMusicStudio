import { watchEffect } from "vue";
import { CalculateFunction, Node, NodeInterface, type INodeState } from "baklavajs";
import { ATTRIBUTE_KEYS, ATTRIBUTES, BUILT_IN_DEFAULTS, type AttributeKey, type AttributeValues, type ShutterValue } from "@/programming/attributes";
import { AttributeInputInterface, type AttributeInputState } from "@/graph/interfaces/AttributeInputInterface";
import { AttributeSelectInterface } from "@/graph/interfaces/AttributeSelectInterface";
import { SelectTargetInterface } from "@/graph/interfaces/SelectTargetInterface";
import { getProfile } from "@/programming/profile";
import { decodeTarget, resolveTarget } from "@/programming/targets";
import type { Color } from "@/graph/colors";

type Inputs = { target: string; attributes: AttributeKey[] } & Partial<Record<AttributeKey, AttributeInputState | number | Color>>;

interface Outputs {
    attributeTarget: string;
    attributes: AttributeValues;
}

type SavedInputs = Record<string, { value?: unknown } | undefined>;

const NODE_TYPE = "Attribute Output";
const DEFAULT_ATTRIBUTES: AttributeKey[] = ["dimmer"];

function initialValue(key: AttributeKey): AttributeInputState["value"] {
    if (key === "color") {
        return [255, 255, 255];
    }
    if (key === "shutter") {
        return { mode: "open", rate: 10 };
    }
    return BUILT_IN_DEFAULTS[key] as number;
}

function isAttributeKey(v: unknown): v is AttributeKey {
    return typeof v === "string" && (ATTRIBUTE_KEYS as readonly string[]).includes(v);
}

/**
 * Attribute Output (feature 004, FR-007, contracts/programming-ui.md): sets semantic attributes on the node's target
 * (the clip target, a group or a fixture). Only the selected attributes get an input ("+ Add attribute", × removes);
 * a selected input is set from its connection or, unconnected, from its editor value. The processor resolves the
 * target and merges the values per attribute (R4).
 */
export class AttributeOutputNode extends Node<Inputs, Outputs> {
    public type = NODE_TYPE;
    public _title = NODE_TYPE;

    public inputs = {
        target: new SelectTargetInterface(),
        attributes: new AttributeSelectInterface([...DEFAULT_ATTRIBUTES]),
    } as unknown as Record<keyof Inputs, NodeInterface>;

    public outputs = {
        attributeTarget: new NodeInterface<string>("Target", "").setHidden(true),
        attributes: new NodeInterface<AttributeValues>("Attributes", {}).setHidden(true),
    };

    private unwatch?: () => void;

    public constructor() {
        super();
        this.initializeIo();
        this.syncAttributeInputs();
        // slot names, pan/tilt hint and missing-target state follow the target (contracts/programming-ui.md)
        this.unwatch = watchEffect(() => this.updateHints());
    }

    /** Called on the reactive node (graph.addNode), so inputs added or removed later show up in the editor. */
    public override onPlaced() {
        this.selection.events.setValue.subscribe(this, () => this.syncAttributeInputs());
        this.syncAttributeInputs();
    }

    public override onDestroy() {
        this.unwatch?.();
        this.selection.events.setValue.unsubscribe(this);
        (this.inputs.target as SelectTargetInterface).destroy();
    }

    public override load(state: INodeState<Inputs, Outputs>) {
        const savedInputs = state.inputs as unknown as SavedInputs;
        const saved = savedInputs.attributes?.value;
        // older saves had an input for every attribute: create them all so their values and connections load, then
        // keep only the enabled or connected ones once the graph has loaded its connections
        const legacy = !Array.isArray(saved);
        const keys = Array.isArray(saved) ? saved.filter(isAttributeKey) : ATTRIBUTE_KEYS.filter((k) => k in savedInputs);
        this.selection.value = keys;
        this.syncAttributeInputs();
        super.load(state);
        if (!legacy) {
            return;
        }
        const graph = this.graph;
        if (graph) {
            graph.hooks.load.subscribe(this, (graphState) => {
                graph.hooks.load.unsubscribe(this);
                this.pruneLegacyInputs(savedInputs);
                return graphState;
            });
        } else {
            this.pruneLegacyInputs(savedInputs);
        }
    }

    private get selection(): AttributeSelectInterface {
        return this.inputs.attributes as unknown as AttributeSelectInterface;
    }

    private get selectedKeys(): AttributeKey[] {
        return (this.selection.value ?? []).filter(isAttributeKey);
    }

    private attributeInput(key: AttributeKey): AttributeInputInterface | undefined {
        return (this.inputs as Record<string, NodeInterface>)[key] as unknown as AttributeInputInterface | undefined;
    }

    private pruneLegacyInputs(savedInputs: SavedInputs) {
        this.selection.value = this.selectedKeys.filter((key) => {
            const v = savedInputs[key]?.value;
            const enabled = typeof v === "object" && v !== null && "enabled" in v && !!(v as AttributeInputState).enabled;
            return enabled || (this.attributeInput(key)?.connectionCount ?? 0) > 0;
        });
        this.syncAttributeInputs();
    }

    /** Adds inputs for newly selected attributes and removes the inputs (and their connections) of deselected ones. */
    private syncAttributeInputs() {
        const keys = this.selectedKeys;
        for (const key of ATTRIBUTE_KEYS) {
            if (!keys.includes(key) && this.attributeInput(key)) {
                this.removeInput(key);
            }
        }
        for (const key of keys) {
            let intf = this.attributeInput(key);
            if (!intf) {
                intf = new AttributeInputInterface(key, ATTRIBUTES[key].label, initialValue(key));
                this.addInput(key, intf as unknown as NodeInterface<Inputs[typeof key]>);
            }
            // reassigned on every sync so the handler uses the reactive node once placed
            intf.onRemove = () => {
                this.selection.value = this.selectedKeys.filter((k) => k !== key);
            };
        }
        this.updateHints();
    }

    private updateHints() {
        const value = (this.inputs.target as SelectTargetInterface).value;
        const target = value === "clip" ? null : decodeTarget(value);
        const resolved = target ? resolveTarget(target) : null;
        const first = resolved?.fixtures[0];
        const profile = first ? getProfile(first.fixtureId) : null;
        const normalized = !!resolved?.fixtures.some((f) => getProfile(f.fixtureId)?.panTiltNormalized);
        for (const key of this.selectedKeys) {
            const intf = this.attributeInput(key);
            if (!intf) {
                continue;
            }
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
        for (const key of this.selectedKeys) {
            const intf = this.attributeInput(key);
            if (!intf) {
                continue;
            }
            const raw = inputs[key] as unknown;
            // an unconnected input holds its editor state, a connected one the plain value
            const v = (
                intf.connectionCount === 0 && typeof raw === "object" && raw !== null && "enabled" in raw ? (raw as AttributeInputState).value : raw
            ) as AttributeInputState["value"];
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
