import { setType } from "@baklavajs/interface-types";
import { SliderInterface as OriginalSliderInterface } from "@baklavajs/renderer-vue";
import { NumberType } from "../interface-types";

export class SliderInterface extends OriginalSliderInterface {
    constructor(name: string, value: number, min: number, max: number) {
        super(name, value, min, max);
        this.use(setType, NumberType);
    }
}
