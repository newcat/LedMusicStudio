import { createApp } from "vue";
import * as VueRouter from "vue-router";
import { createPinia } from "pinia";

import { wasmInterop } from "./wasmInterop";
import { initializeNativeAdapter } from "./native";
import "./utils/comlinkVueTransferHandler";

import "splitpanes/dist/splitpanes.css";
import "@baklavajs/themes/dist/syrup-dark.css";
import "primevue/resources/themes/vela-blue/theme.css";
import "primeicons/primeicons.css";
import "@mdi/font/css/materialdesignicons.css";
import "./index.css";
import "./styles/all.scss";

import App from "./App.vue";
import PrimeVue from "primevue/config";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";

async function main() {
    await initializeNativeAdapter();
    wasmInterop.init();

    const pinia = createPinia();

    const router = VueRouter.createRouter({
        history: VueRouter.createWebHashHistory(),
        routes: [{ path: "/", component: App }],
    });

    document.getElementById("loadingPlaceholder")?.remove();

    createApp(App).use(PrimeVue).use(ToastService).directive("tooltip", Tooltip).use(pinia).use(router).mount("#app");
}

main();
