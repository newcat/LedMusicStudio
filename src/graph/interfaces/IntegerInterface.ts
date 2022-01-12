import { setType } from "@baklavajs/interface-types";
import { IntegerInterface as OriginalIntegerInterface } from "@baklavajs/renderer-vue";
import { NumberType } from "../interface-types";

export class IntegerInterface extends OriginalIntegerInterface {
    constructor(name: string, value: number, min?: number, max?: number) {
        super(name, value, min, max);
        this.use(setType, NumberType);
    }
}
