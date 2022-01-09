import { Node } from "@baklavajs/core";

const operations = ["AND", "OR", "XOR", "NAND", "NOR", "XNOR"];

export class LogicNode extends Node {
    type = "Logic";
    name = this.type;

    constructor() {
        super();
        this.addInputInterface("A", "CheckboxOption", true, { type: "boolean" });
        this.addInputInterface("B", "CheckboxOption", true, { type: "boolean" });
        this.addOption("Gatter", "SelectOption", "AND", undefined, { items: operations });
        this.addOutputInterface("Result", { type: "boolean" });
    }

    calculate() {
        const a = this.getInterface("A").value;
        const b = this.getInterface("B").value;
        const operation = this.getOptionValue("Gatter").selected;
        let output = false;
        switch (operation) {
            case "AND":
                output = a && b;
                break;
            case "OR":
                output = a || b;
                break;
            case "XOR":
                output = a ? !b : b;
                break;
            case "NAND":
                output = !(a && b);
                break;
            case "NOR":
                output = !(a || b);
                break;
            case "XNOR":
                output = a ? b : !b;
                break;
        }
        console.log(a, b, output);
        this.getInterface("Result").value = output;
    }
}
