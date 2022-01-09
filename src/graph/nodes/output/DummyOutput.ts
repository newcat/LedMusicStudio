import { NodeBuilder } from "@baklavajs/core";

export const DummyOutput = new NodeBuilder("DummyOutput")
    .addInputInterface("Colors", undefined, () => [[0, 0, 0]], { type: "color_array" })
    .addOption("Preview", "PreviewOption", () => [[0, 0, 0]])
    .onCalculate((n) => {
        n.setOptionValue("Preview", n.getInterface("Colors").value);
    })
    .build();
