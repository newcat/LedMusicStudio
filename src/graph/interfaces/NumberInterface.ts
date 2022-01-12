import { setType } from "@baklavajs/interface-types";
import { NumberInterface as OriginalNumberInterface } from "@baklavajs/renderer-vue";
import { NumberType } from "../interface-types";

export class NumberInterface extends OriginalNumberInterface {
    constructor(name: string, value: number, min?: number, max?: number) {
        super(name, value, min, max);
        this.use(setType, NumberType);
    }
}
