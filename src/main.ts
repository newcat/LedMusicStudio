import { createApp } from "vue";

import PrimeVue from "primevue/config";
import "primevue/resources/themes/vela-blue/theme.css";
import "primevue/resources/primevue.min.css";
import "primeicons/primeicons.css";

import App from "./App.vue";

import "@mdi/font/css/materialdesignicons.css";

import "./index.css";
import "./styles/all.scss";

import "@baklavajs/themes/dist/syrup-dark.css";

const pinia = createPinia();

import { wasmInterop } from "./wasmInterop";
wasmInterop.init();

import * as VueRouter from "vue-router";
import { createPinia } from "pinia";
const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes: [{ path: "/", component: App }],
});

createApp(App).use(PrimeVue).use(pinia).use(router).mount("#app");
