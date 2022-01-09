import { ViewPlugin } from "@baklavajs/plugin-renderer-vue";

import ColorOption from "./ColorOption.vue";
import CustomButtonOption from "./CustomButtonOption.vue";
import PeakOption from "./PeakOption.vue";
import PreviewOption from "./PreviewOption.vue";
import SpectrumOption from "./SpectrumOption.vue";

export function registerOptions(vp: ViewPlugin) {
    vp.registerOption("ColorOption", ColorOption);
    vp.registerOption("CustomButtonOption", CustomButtonOption);
    vp.registerOption("PeakOption", PeakOption);
    vp.registerOption("PreviewOption", PreviewOption);
    vp.registerOption("SpectrumOption", SpectrumOption);
}
