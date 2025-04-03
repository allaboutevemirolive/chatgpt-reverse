// packages/scripts/vite.config.ts
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    build: {
        outDir: path.resolve(__dirname, '../../build'),
        emptyOutDir: false, // Keep other build artifacts
        // We don't use `lib` mode directly when having multiple distinct entry points like this.
        // Instead, we configure Rollup directly.
        rollupOptions: {
            // Define multiple entry points
            input: {
                interceptor: path.resolve(__dirname, 'src/interceptor.ts'),
                loadScript: path.resolve(__dirname, 'src/loadScript.ts'),
                // Add more entries here if needed
                // anotherUtil: path.resolve(__dirname, 'src/anotherUtil.ts'),
            },
            output: {
                // Define the output pattern for the generated chunks (scripts)
                // [name] will be replaced by the key in the input object (e.g., 'interceptor')
                entryFileNames: '[name].js',
                // Define the format for each entry point
                // 'iife' is often suitable for injected scripts. Use 'es' if needed.
                format: 'iife',
                // Provide a name for the IIFE global scope if needed (optional)
                // This might require more complex configuration if different names are needed per entry.
                // Often not strictly necessary for injected scripts.
                // name: 'myInjectedScripts', // Example - might pollute global scope
            }
        }
    },
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../shared/src'),
        },
    }
});
