import { defineNode } from "baklavajs";
import { ColorArrayInterface, IntegerInterface, PreviewInterface } from "@/graph/interfaces";
import { scaleColorArray } from "@/utils";

export const PreviewNode = defineNode({
    type: "Preview",
    inputs: {
        colors: () => new ColorArrayInterface("Colors"),
        ledCount: () => new IntegerInterface("Led Count", 30, 1),
    },
    outputs: {
        preview: () => new PreviewInterface("Preview"),
    },
    calculate({ colors, ledCount }) {
        return { preview: scaleColorArray(colors, ledCount) };
        /*globalProcessor.globalPreview = colors;
        globalProcessor.events.globalPreviewUpdated.emit();*/
    },
});
