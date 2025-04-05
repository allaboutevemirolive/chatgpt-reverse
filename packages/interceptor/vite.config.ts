// packages/interceptor/vite.config.ts
import { defineConfig, LibraryFormats } from "vite";
import path from "node:path";

export default defineConfig({
    build: {
        outDir: path.resolve(__dirname, "../../build"),
        emptyOutDir: false, // Do not clear the root build dir
        lib: {
            entry: path.resolve(__dirname, "src/interceptor.ts"),
            name: "InterceptorScript", // Global variable name for IIFE
            formats: ["iife"] as LibraryFormats[],
            fileName: () => "interceptor.js", // Output filename
        },
        rollupOptions: {
            // No external needed usually for injected scripts
        },
    },
    resolve: {
        alias: {
            // Only include if shared is a dependency
            // '@shared': path.resolve(__dirname, '../shared/src'),
        },
    },
});
