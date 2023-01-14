import { createApp } from "vue";
import * as VueRouter from "vue-router";
import { createPinia } from "pinia";
import { wasmInterop } from "./wasmInterop";

import "splitpanes/dist/splitpanes.css";
import "./index.css";
import "./styles/all.scss";
import "primevue/resources/themes/vela-blue/theme.css";
import "primevue/resources/primevue.min.css";
import "primeicons/primeicons.css";
import "@mdi/font/css/materialdesignicons.css";
import "@baklavajs/themes/dist/syrup-dark.css";

import App from "./App.vue";
import PrimeVue from "primevue/config";
import ToastService from "primevue/toastservice";

const pinia = createPinia();

wasmInterop.init();

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes: [{ path: "/", component: App }],
});

createApp(App).use(PrimeVue).use(ToastService).use(pinia).use(router).mount("#app");
