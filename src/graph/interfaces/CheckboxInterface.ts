import { setType } from "@baklavajs/interface-types";
import { CheckboxInterface as OriginalCheckboxInterface } from "@baklavajs/renderer-vue";
import { BooleanType } from "../interface-types";

export class CheckboxInterface extends OriginalCheckboxInterface {
    constructor(name: string, value: boolean) {
        super(name, value);
        this.use(setType, BooleanType);
    }
}
