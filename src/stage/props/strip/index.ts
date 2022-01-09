import { PropInfo } from "../prop";
import { StripProp } from "./strip";
import StripComponent from "./Strip.vue";
import StripSettingsComponent from "./StripSettings.vue";

export default {
    type: "StripProp",
    class: StripProp,
    component: StripComponent,
    settingsComponent: StripSettingsComponent,
} as PropInfo;
