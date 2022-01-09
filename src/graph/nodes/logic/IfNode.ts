import { Node } from "@baklavajs/core";

export class IfNode extends Node {
    type = "If";
    name = this.type;

    constructor() {
        super();
        this.addInputInterface("Condition", "CheckboxOption", false, { type: "boolean" });
        this.addInputInterface("True Value", undefined, 0, { type: "any" });
        this.addInputInterface("False Value", undefined, 0, { type: "any" });
        this.addOutputInterface("Output", { type: "any" });
    }

    calculate() {
        const conditionVal = this.getInterface("Condition").value;
        const outputInterface = this.getInterface("Output");
        if (conditionVal) {
            outputInterface.value = this.getInterface("True Value").value;
        } else {
            outputInterface.value = this.getInterface("False Value").value;
        }
    }
}
