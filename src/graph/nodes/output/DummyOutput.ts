import { ColorArrayInterface, PreviewInterface } from "@/graph/interfaces";
import { defineNode } from "@baklavajs/core";

export const DummyOutput = defineNode({
    type: "DummyOutput",
    inputs: {
        colors: () => new ColorArrayInterface("Colors"),
    },
    outputs: {
        preview: () => new PreviewInterface("Preview"),
    },
    calculate: ({ colors }) => ({ preview: colors }),
});
