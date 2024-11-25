import { setType, CheckboxInterface as OriginalCheckboxInterface } from "baklavajs";
import { BooleanType } from "../interface-types";

export class CheckboxInterface extends OriginalCheckboxInterface {
    constructor(name: string, value: boolean) {
        super(name, value);
        this.use(setType, BooleanType);
    }
}
