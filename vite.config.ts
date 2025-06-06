import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { visualizer } from "rollup-plugin-visualizer";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
    base: process.env.ELECTRON == "true" ? "./" : process.env.BASE_URL ?? "",
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
        tailwindcss(),
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
    build: {
        sourcemap: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, "index.html"),
                visualization: path.resolve(__dirname, "visualization.html"),
            },
        },
    },
});
