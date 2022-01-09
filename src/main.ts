import { createApp } from 'vue'
import App from "./App.vue";

import { BaklavaVuePlugin } from "@baklavajs/plugin-renderer-vue";
Vue.use(BaklavaVuePlugin);

import "./styles/all.scss";

import { wasmInterop } from "./wasmInterop";
wasmInterop.init();

createApp(App).mount('#app')
