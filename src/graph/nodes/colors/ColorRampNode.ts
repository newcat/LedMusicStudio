import { NodeBuilder } from "@baklavajs/core";

export const ColorRampNode = new NodeBuilder("Color Ramp")
    .addInputInterface("Factor", "SliderOption", 0, { type: "number", min: 0, max: 1 })
    .addOption("Color Ramp", "ColorRampOption", () => [
        { color: [0, 0, 0], position: 0 },
        { color: [255, 255, 255], position: 1 },
    ])
    .addOutputInterface("Color Band", { type: "color_array" })
    .addOutputInterface("Single Color", { type: "color_single" })
    .build();
