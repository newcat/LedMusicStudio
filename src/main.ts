import { createApp } from "vue";
import * as VueRouter from "vue-router";
import { createPinia } from "pinia";

import { wasmInterop } from "./wasmInterop";
import { initializeNativeAdapter } from "./native";
import "./utils/comlinkVueTransferHandler";

import "splitpanes/dist/splitpanes.css";
import "@baklavajs/themes/dist/syrup-dark.css";
import Nora from "@primevue/themes/nora";
import "primeicons/primeicons.css";
import "@mdi/font/css/materialdesignicons.css";
import "@fontsource-variable/inter";
import "./index.css";

import App from "./App.vue";
import PrimeVue from "primevue/config";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";
import { definePreset, palette } from "@primevue/themes";

async function main() {
    await initializeNativeAdapter();
    await wasmInterop.init();

    const pinia = createPinia();

    const router = VueRouter.createRouter({
        history: VueRouter.createWebHashHistory(),
        routes: [{ path: "/", component: App }],
    });

    const preset = definePreset(Nora, {
        semantic: {
            primary: palette("{sky}"),
        },
    });

    document.getElementById("loadingPlaceholder")?.remove();
    createApp(App)
        .use(PrimeVue, {
            theme: {
                preset,
            },
        })
        .use(ToastService)
        .directive("tooltip", Tooltip)
        .use(pinia)
        .use(router)
        .mount("#app");
}

void main();
