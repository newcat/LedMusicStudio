import { markRaw } from "vue";
import { NodeInterface, NodeInterfaceType, setType } from "baklavajs";
import type { AttributeKey, ShutterValue, SlotInfo } from "@/programming/attributes";
import { Color } from "../colors";
import { ColorSingleType, NumberType } from "../interface-types";
import AttributeInputOption from "../options/AttributeInputOption.vue";

/** Value stored while the input is not connected: the "enabled" flag and the editor value (feature 004). */
export interface AttributeInputState {
    enabled: boolean;
    value: number | Color | ShutterValue;
}

/**
 * One attribute input of the Attribute Output node. Unconnected: unset unless enabled; connected: always set
 * (connecting an input enables it). Color inputs take graph colors (0..255), shutter inputs a strobe rate in Hz.
 */
export class AttributeInputInterface extends NodeInterface<AttributeInputState> {
    /** Slot names of the first target fixture (discrete attributes). */
    public slots: SlotInfo[] = [];
    /** Extra label text, e.g. "(0–1, no angle range)". */
    public hint = "";

    public constructor(
        public readonly attributeKey: AttributeKey,
        name: string,
        value: AttributeInputState["value"]
    ) {
        super(name, { enabled: false, value });
        this.setComponent(markRaw(AttributeInputOption));
        // the type governs connections (a number or color arrives when connected); the stored state is editor-only
        const type = attributeKey === "color" ? ColorSingleType : NumberType;
        this.use(setType, type as unknown as NodeInterfaceType<AttributeInputState>);
    }
}
