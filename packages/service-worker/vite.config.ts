// packages/service-worker/vite.config.ts
import { defineConfig } from "vite";
import path from "node:path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
    plugins: [
        wasm(), // Needed for tiktoken in background
        topLevelAwait(), // Needed for tiktoken/wasm in background
    ],
    build: {
        outDir: path.resolve(__dirname, "../../build"),
        emptyOutDir: false, // Keep other build artifacts
        lib: {
            entry: path.resolve(__dirname, "src/background.ts"),
            name: "serviceWorker",
            // MV3 service workers MUST be ES modules ('es')
            formats: ["es"],
            fileName: () => "background.js", // Output filename for manifest
        },
        rollupOptions: {
            // Service workers typically don't externalize dependencies
        },
    },
    resolve: {
        alias: {
            "@shared": path.resolve(__dirname, "../shared/src"),
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
