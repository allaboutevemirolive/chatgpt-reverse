// scripts/package.mjs
import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import { fileURLToPath } from "node:url";

const TARGET_CHROME = "chrome";
const TARGET_FIREFOX = "firefox";

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define project root and paths
const projectRoot = path.resolve(__dirname, "..");
const buildDir = path.resolve(projectRoot, "build");
const outputDir = path.resolve(projectRoot, "dist");
const publicDir = path.resolve(projectRoot, "public");

async function main() {
    // 1. Determine target browser from command line arguments
    const args = process.argv.slice(2); // Remove 'node' and script path
    const targetBrowser = args[0]?.toLowerCase() === TARGET_FIREFOX
        ? TARGET_FIREFOX
        : TARGET_CHROME; // Default to chrome

    console.log(`📦 Starting packaging process for: ${targetBrowser.toUpperCase()}`);

    // 2. Define manifest paths
    const chromeManifestPath = path.resolve(publicDir, "manifest.json");
    const firefoxManifestPath = path.resolve(publicDir, "manifest.firefox.json");
    const buildManifestPath = path.resolve(buildDir, "manifest.json"); // Destination path

    // Select the correct source manifest
    const sourceManifestPath = targetBrowser === TARGET_FIREFOX ? firefoxManifestPath : chromeManifestPath;

    try {
        // 3. Read package.json to get name and version
        const packageJsonPath = path.resolve(projectRoot, "package.json");
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
        const packageData = JSON.parse(packageJsonContent);
        const name = packageData.name || "extension";
        const version = packageData.version || "1.0.0";

        // 4. Define output filename based on target
        const outputFilename = `${name}-v${version}-${targetBrowser}.zip`;
        const outputPath = path.resolve(outputDir, outputFilename);

        // 5. Ensure build directory exists and is ready (assuming build ran first)
        if (!fs.existsSync(buildDir)) {
            console.error(
                `❌ Error: Build directory not found at ${buildDir}. Run the build process first.`
            );
            process.exit(1);
        }
        // Ensure selected manifest source exists
        if (!fs.existsSync(sourceManifestPath)) {
            console.error(`❌ Error: Source manifest not found at ${sourceManifestPath}.`);
            process.exit(1);
        }

        // 6. Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            console.log(`Creating output directory: ${outputDir}`);
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 7. Prepare build directory: Copy the target manifest into build/manifest.json
        console.log(`Copying ${path.basename(sourceManifestPath)} to ${buildManifestPath}...`);
        // Remove existing manifest in build dir if it exists, to avoid confusion
        if (fs.existsSync(buildManifestPath)) {
            fs.unlinkSync(buildManifestPath);
        }
        fs.copyFileSync(sourceManifestPath, buildManifestPath);
        console.log(`Manifest copied successfully.`);


        // 8. Create a file to stream archive data to.
        console.log(`Creating archive: ${outputPath}`);
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", {
            zlib: { level: 9 }, // Sets the compression level.
        });

        output.on("close", () => {
            console.log(`✅ Successfully created ${targetBrowser.toUpperCase()} archive: ${outputPath}`);
            console.log(`Total size: ${archive.pointer()} total bytes`);
        });

        archive.on("end", () => {
            console.log("Data stream drained.");
        });

        archive.on("warning", (err) => {
            if (err.code === "ENOENT") {
                console.warn("Archiver warning (ENOENT):", err);
            } else {
                throw err;
            }
        });

        archive.on("error", (err) => {
            throw err;
        });

        archive.pipe(output);

        console.log(`Adding contents from ${buildDir} to archive...`);
        archive.directory(buildDir, false);

        await archive.finalize();
        console.log("Archive finalized.");

    } catch (error) {
        console.error(`❌ ${targetBrowser.toUpperCase()} packaging failed:`, error);
        process.exit(1);
    }
}

main();
