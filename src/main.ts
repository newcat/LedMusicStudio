import { createApp } from 'vue'
import App from "./App.vue";

import "./styles/all.scss";

import { wasmInterop } from "./wasmInterop";
wasmInterop.init();

createApp(App).mount('#app')
