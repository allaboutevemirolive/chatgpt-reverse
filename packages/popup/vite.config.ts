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
                auth: path.resolve(__dirname, "auth.html"),
            },
            // If outputting multiple files, ensure filenames are distinct
            // Vite usually handles this, but be aware.
            // output: {
            //  entryFileNames: `assets/[name].js`,
            //  chunkFileNames: `assets/[name].js`,
            //  assetFileNames: `assets/[name].[ext]`
            // }
        },
    },
    resolve: {
        alias: {
            "@shared": path.resolve(__dirname, "../shared/src"),
        },
    },
});
