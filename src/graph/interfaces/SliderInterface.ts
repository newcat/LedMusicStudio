import { setType, SliderInterface as OriginalSliderInterface } from "baklavajs";
import { NumberType } from "../interface-types";

export class SliderInterface extends OriginalSliderInterface {
    constructor(name: string, value: number, min: number, max: number) {
        super(name, value, min, max);
        this.use(setType, NumberType);
    }
}
