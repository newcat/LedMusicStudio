import { createApp } from "vue";
import * as VueRouter from "vue-router";
import { createPinia } from "pinia";
import { wasmInterop } from "./wasmInterop";

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

const pinia = createPinia();

wasmInterop.init();

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes: [{ path: "/", component: App }],
});

createApp(App).use(PrimeVue).use(ToastService).directive("tooltip", Tooltip).use(pinia).use(router).mount("#app");
