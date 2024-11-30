import { setType, NumberInterface as OriginalNumberInterface } from "baklavajs";
import { NumberType } from "../interface-types";

export class NumberInterface extends OriginalNumberInterface {
    constructor(name: string, value: number, min?: number, max?: number) {
        super(name, value, min, max);
        this.use(setType, NumberType);
    }
}
