import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    base: process.env.ELECTRON == "true" ? "./" : "",
    server: {
        port: 3000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            lms_bridge: path.resolve(__dirname, "./src/bindings"),
        },
    },
    plugins: [
        vue(),
        visualizer({
            open: false,
            filename: "dist/stats.html",
        }),
    ],
    optimizeDeps: {
        esbuildOptions: {
            target: "esnext",
        },
    },
});
