import { markRaw } from "vue";
import { NodeInterface } from "baklavajs";
import type { AttributeKey } from "@/programming/attributes";
import AttributeSelectOption from "../options/AttributeSelectOption.vue";

/**
 * Attribute selection of the Attribute Output node: the keys that get an input, in the order they were added.
 * Not a port; the node adds and removes its attribute inputs when the value changes.
 */
export class AttributeSelectInterface extends NodeInterface<AttributeKey[]> {
    public constructor(value: AttributeKey[]) {
        super("Attributes", value);
        this.setComponent(markRaw(AttributeSelectOption));
        this.setPort(false);
    }
}
