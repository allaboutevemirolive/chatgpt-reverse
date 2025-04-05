// packages/content-script/vite.config.ts
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
    build: {
        // Output to the root build directory
        outDir: path.resolve(__dirname, "../../build"),
        // IMPORTANT: Prevent Vite from clearing the build directory (other packages use it)
        emptyOutDir: false,
        // Build as a library (since it's not an HTML page)
        lib: {
            // Path to the entrypoint source file
            entry: path.resolve(__dirname, "src/content.ts"),
            // Name for the IIFE/UMD global variable (optional but good practice)
            name: "contentScript",
            // Output format(s). 'iife' is common for content scripts for isolation.
            // Use 'es' if your manifest specifies "type": "module" for the content script.
            formats: ["iife"],
            // Define the output filename
            fileName: () => "content.js",
        },
        rollupOptions: {
            // You generally don't need to externalize anything for content scripts
            // unless you are injecting massive libraries and want to control loading.
        },
    },
    // Optional: Define alias for cleaner imports from shared package
    resolve: {
        alias: {
            "@shared": path.resolve(__dirname, "../shared/src"),
        },
    },
});
