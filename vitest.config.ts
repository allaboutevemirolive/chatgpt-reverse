// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./tests/setup.ts",
        include: ["packages/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    },
    // Optional: Alias resolution matching our Vite configs
    // resolve: {
    //   alias: {
    //     '@shared': path.resolve(__dirname, './packages/shared/src'),
    //   },
    // }
});
