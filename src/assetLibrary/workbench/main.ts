import { createApp } from "vue";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import { definePreset, palette } from "@primevue/themes";
import "primeicons/primeicons.css";
import "@fontsource-variable/inter";
import "@/index.css";
import Workbench from "./Workbench.vue";

const preset = definePreset(Aura, {
    semantic: {
        primary: palette("{sky}"),
        colorScheme: { dark: { surface: palette("{gray}") } },
    },
});

createApp(Workbench).use(PrimeVue, { theme: { preset } }).mount("#app");
