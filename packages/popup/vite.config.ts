// ./packages/popup/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: path.resolve(__dirname, '../../build/popup'), // Output to root build/popup dir
        emptyOutDir: true, // Clear this specific subdirectory on build
        rollupOptions: {
            // Input is typically index.html for popup
            input: {
                popup: path.resolve(__dirname, 'index.html'),
            },
            // Adjust output chunk names if needed
            // output: {
            //   entryFileNames: `assets/[name].js`,
            //   chunkFileNames: `assets/[name].js`,
            //   assetFileNames: `assets/[name].[ext]`
            // }
        },
    },
    resolve: {
        alias: {
            // Optional: Alias to shared source for better HMR during dev
            // Adjust path based on your structure
            '@shared': path.resolve(__dirname, '../shared/src'),
        },
    }
});
