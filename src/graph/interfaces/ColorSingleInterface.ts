import { NodeInterface } from "@baklavajs/core";
import { setType } from "@baklavajs/interface-types";
import { markRaw } from "vue";
import { Color } from "../colors";
import { ColorSingleType } from "../interface-types";
import { ColorOption } from "../options";

export class ColorSingleInterface extends NodeInterface<Color> {
    public constructor(name: string, value: Color = [0, 0, 0]) {
        super(name, value);
        this.setComponent(markRaw(ColorOption));
        this.use(setType, ColorSingleType)
    }
}
