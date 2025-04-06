// ./packages/popup/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: "./", // Use relative paths for assets
    build: {
        outDir: path.resolve(__dirname, "../../build/popup"),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: path.resolve(__dirname, "index.html"),
            },
        },
    },
    resolve: {
        alias: {
            "@shared": path.resolve(__dirname, "../shared/src"),
        },
    },
});
