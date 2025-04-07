// scripts/copy-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET_CHROME = 'chrome';
const TARGET_FIREFOX = 'firefox';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define project root and paths
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.resolve(projectRoot, 'public');
const buildDir = path.resolve(projectRoot, 'build');

async function main() {
    // 1. Determine target browser from command line arguments
    const args = process.argv.slice(2); // Remove 'node' and script path
    const targetBrowser = args[0]?.toLowerCase();

    if (!targetBrowser || (targetBrowser !== TARGET_CHROME && targetBrowser !== TARGET_FIREFOX)) {
        console.error(`❌ Error: Target browser (${TARGET_CHROME} or ${TARGET_FIREFOX}) must be specified as the first argument.`);
        console.error(`   Usage: node ${path.basename(__filename)} <chrome|firefox>`);
        process.exit(1);
    }

    console.log(`📝 Preparing manifest for: ${targetBrowser.toUpperCase()}`);

    // 2. Define manifest paths
    const sourceManifestFilename = `manifest.${targetBrowser}.json`;
    const sourceManifestPath = path.resolve(publicDir, sourceManifestFilename);
    const destManifestPath = path.resolve(buildDir, 'manifest.json'); // Destination is always manifest.json

    try {
        // 3. Ensure build directory exists (might be run after clean)
        if (!fs.existsSync(buildDir)) {
            console.log(`Creating build directory: ${buildDir}`);
            fs.mkdirSync(buildDir, { recursive: true });
        }

        // 4. Ensure source manifest exists
        if (!fs.existsSync(sourceManifestPath)) {
            throw new Error(`Source manifest not found: ${sourceManifestPath}`);
        }

        // 5. Copy the target manifest to build/manifest.json
        console.log(`Copying ${sourceManifestFilename} to ${destManifestPath}...`);
        fs.copyFileSync(sourceManifestPath, destManifestPath);
        console.log('✅ Manifest copied successfully.');

    } catch (error) {
        console.error(`❌ Error copying manifest:`, error);
        process.exit(1);
    }
}

main();
