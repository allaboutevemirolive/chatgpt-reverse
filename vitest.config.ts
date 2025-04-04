// vitest.config.ts 
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true, // Use global APIs (describe, it, expect)
        environment: 'jsdom', // Simulate DOM environment for React components
        setupFiles: './tests/setup.ts', // Optional setup file (see below)
        include: ['packages/**/*.{test,spec}.?(c|m)[jt]s?(x)'], // Look for tests in all packages
    },
    // Optional: Alias resolution matching our Vite configs
    // resolve: {
    //   alias: {
    //     '@shared': path.resolve(__dirname, './packages/shared/src'),
    //   },
    // }
});
