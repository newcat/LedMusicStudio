import { createApp } from "vue";
import App from "./App.vue";

import "./index.css";
import "./styles/all.scss";

import "@baklavajs/themes/dist/syrup-dark.css";

import { wasmInterop } from "./wasmInterop";
wasmInterop.init();

createApp(App).mount("#app");
