import { NodeInterface, setType } from "baklavajs";
import { Color } from "../colors";
import { ColorArrayType } from "../interface-types";

export class ColorArrayInterface extends NodeInterface<Color[]> {
    public constructor(name: string, value: Color[] = [[0, 0, 0]]) {
        super(name, value);
        this.use(setType, ColorArrayType);
    }
}
