import { Node } from "@baklavajs/core";

const operations = ["==", ">", "<", ">=", "<="];

export class BooleanNode extends Node {
    type = "Boolean";
    name = this.type;

    constructor() {
        super();
        this.addInputInterface("Value 1", "NumberOption", 0, { type: "number" });
        this.addInputInterface("Value 2", "NumberOption", 0, { type: "number" });
        this.addInputInterface("Round Values", "CheckboxOption", false, { type: "boolean" });
        this.addInputInterface("Invert Output", "CheckboxOption", false, { type: "boolean" });
        this.addOption("Operation", "SelectOption", "==", undefined, { items: operations });
        this.addOutputInterface("Result", { type: "boolean" });
    }

    calculate() {
        const val1 = this.getInterface("Value 1").value;
        const val2 = this.getInterface("Value 2").value;
        const useInt = this.getInterface("Round Values").value;
        const invert = this.getInterface("Invert Output").value;
        const operation = this.getOptionValue("Operation");

        let result = false;
        switch (operation) {
            case "==":
                result = useInt ? Math.round(val1) === Math.round(val2) : val1 === val2;
                break;
            case ">":
                result = useInt ? Math.round(val1) > Math.round(val2) : val1 > val2;
                break;
            case "<":
                result = useInt ? Math.round(val1) < Math.round(val2) : val1 < val2;
                break;
            case ">=":
                result = useInt ? Math.round(val1) >= Math.round(val2) : val1 >= val2;
                break;
            case "<=":
                result = useInt ? Math.round(val1) <= Math.round(val2) : val1 <= val2;
                break;
        }
        if (invert) {
            result = !result;
        }

        this.getInterface("Result").value = result;
    }
}
