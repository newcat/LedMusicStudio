import { markRaw } from "vue";
import { NodeInterface, setType } from "baklavajs";
import { Color } from "../colors";
import { ColorArrayType } from "../interface-types";
import PreviewOptionVue from "../options/PreviewOption.vue";

export class PreviewInterface extends NodeInterface<Color[]> {
    public constructor(name: string, value: Color[] = [[0, 0, 0]]) {
        super(name, value);
        this.use(setType, ColorArrayType);
        this.setComponent(markRaw(PreviewOptionVue));
        this.setPort(false);
    }
}
