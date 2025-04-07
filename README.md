<!-- # ChatGPT Reverse -->

<p align="center">
  <img src="./assets/logo.svg" alt="Project Logo" width="450"/>
</p>

<p align="center">
  <img src="./assets/chatgpt_reverse.png" alt="ChatGPT Reverse Logo" width="600"/>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
  <a href="https://semver.org"><img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version"/></a>
</p>

## Overview

This is a Chrome & Firefox Extension designed to interact with ChatGPT, leveraging potentially reverse-engineered API calls. It adheres strictly to the Manifest V3 (MV3) architecture.

The project is structured as a **monorepo** using **pnpm workspaces** to enforce modularity and separation of concerns between the different parts of the extension.

## Technology Stack

*   **Package Manager:** [pnpm](https://pnpm.io/) (using workspaces)
*   **Bundler/Build Tool:** [Vite](https://vitejs.dev/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **UI (Popup):** [React](https://react.dev/)
*   **Linting/Formatting:** [Biome](https://biomejs.dev/)
*   **Extension Framework:** Manifest V3 (MV3)

## Project Structure

The monorepo is organized into several distinct packages within the `packages/` directory, plus root configuration and static assets:

*   `packages/popup`: Contains the React code for the extension's popup UI (`action.default_popup`).
*   `packages/content-script`: Code injected into and interacting with web pages (specifically `chatgpt.com` as per the manifest).
*   `packages/service-worker`: The background service worker handling core logic, event listeners, and message passing (MV3 standard).
*   `packages/shared`: Common TypeScript types, utility functions, constants, etc., shared across other packages. Built independently using `tsc`.
*   `packages/interceptor`: A dedicated script, likely for intercepting network requests, intended to be injected into the page context. Built as an IIFE.
*   `packages/loadscript`: A utility script, likely responsible for injecting other scripts (like the interceptor) into the page context. Built as an IIFE.
*   `public/`: Contains root-level static assets for the extension, primarily `manifest.chrome.json`, `manifest.firefox.json`, and icons.
*   `hosting/`: Contains static files for Firebase Hosting (e.g., `privacy.html`).
*   `build/`: **(Generated)** The output directory containing the intermediate files before packaging.
*   `dist/`: **(Generated)** The output directory containing the final packaged `.zip` files for distribution.
*   `scripts/`: Contains build/packaging helper scripts (e.g., `package.mjs`).

Each package (`content-script`, `service-worker`, `interceptor`, `loadscript`, `popup`) utilizes its own `vite.config.ts`, configured for its specific output requirements (IIFE for injected scripts, ES module for service worker, standard build for popup).

## Prerequisites

*   [Node.js](https://nodejs.org/) (Version 20 or later recommended)
*   [pnpm](https://pnpm.io/installation) (Version 8 or later recommended)
*   [Docker](https://www.docker.com/get-started/) (Optional, for containerized builds)
*   [Firebase CLI](https://firebase.google.com/docs/cli#install_the_firebase_cli) (Optional, only needed for deploying the privacy policy)

## Setup

Clone the repository and install dependencies using pnpm:

```bash
git clone https://github.com/allaboutevemirolive/chatgpt-reverse.git
cd chatgpt-reverse
pnpm install
```

## Development

Use the `dev` script for continuous watching and rebuilding of individual packages during development. Note that this does **not** handle copying the correct manifest file for initial loading; use the `build:*` commands for that first.

```bash
# Watch for changes and rebuild packages (JS/TS only)
pnpm dev
```

**Loading the Extension for Development:**

You need to run a specific build command *before* loading the unpacked extension to ensure the correct `manifest.json` is present in the `build/` directory.

**Chrome/Edge:**

1.  Run the Chrome-specific build command:
    ```bash
    pnpm run build:chrome
    ```
2.  Open Chrome/Edge and navigate to `chrome://extensions/`.
3.  Enable "Developer mode".
4.  Click "Load unpacked".
5.  Select the `build` directory generated at the root of this project.

**Firefox:**

1.  Run the Firefox-specific build command:
    ```bash
    pnpm run build:firefox
    ```
2.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3.  Click "Load Temporary Add-on...".
4.  Select the `build/manifest.json` file (this file will now contain the correct Firefox-specific content thanks to the build script).

**Important Notes for Development:**

*   After the initial load using `build:chrome` or `build:firefox`, if you only change code within a package (e.g., `service-worker`):
    *   `pnpm dev` will rebuild that package's output (e.g., `build/background.js`).
    *   You'll likely need to manually reload the extension in the browser (`chrome://extensions/` or `about:debugging`) to see the changes.
    *   If you change shared code, assets, or manifests, run the full `build:chrome` or `build:firefox` command again and reload the unpacked extension.
*   Changes to the **popup** UI might require reopening the popup.
*   Changes to **content scripts**, **loadScript**, or **interceptor** require reloading the extension *and* refreshing the target web page (`chatgpt.com`).

## Packaging for Distribution

These commands create the final `.zip` files in the `dist/` directory, ready for upload to the respective web stores. They perform a full clean build for the target browser before packaging.

*   **Package for Chrome:**
    ```bash
    pnpm run package:chrome
    ```
    *(Creates `dist/chatgpt-reverse-vX.Y.Z-chrome.zip`)*

*   **Package for Firefox:**
    ```bash
    pnpm run package:firefox
    ```
    *(Creates `dist/chatgpt-reverse-vX.Y.Z-firefox.zip`)*

*   **Package for Both:**
    ```bash
    pnpm run package:all
    ```

## Docker Builds

This method builds the extension package inside a container, ensuring a consistent environment (useful for CI/CD). It defaults to building the **Chrome** package.

*   **Build the Docker image:**
    ```bash
    # This builds the image containing the final packaged zip
    docker build -t chatgpt-reverse-pkg .
    ```
    *(Note: You might need to define a `Dockerfile` first - see example below)*

*   **Build using Docker Compose:**
    ```bash
    # This builds the image defined in docker-compose.yml
    # By default, it might just run pnpm build, not the packaging.
    # You may need to adjust docker-compose.yml or Dockerfile for packaging.
    docker compose build
    ```

*   **How to Retrieve the Packaged ZIP from the Docker Image:**

    If your `Dockerfile` is set up to run the packaging script (e.g., `pnpm run package:chrome`), the resulting `.zip` file will be inside the image, likely in the `/app/dist/` directory (assuming your `WORKDIR` is `/app`).

    **1. Clean Up Existing `dist` Directory (Optional):**

    ```bash
    rm -rf ./dist
    mkdir ./dist
    ```

    **2. Build the Image (if not already done):**

    ```bash
    docker build -t chatgpt-reverse-pkg .
    ```

    **3. Create a Temporary Container:**

    ```bash
    docker create --name extractor_container chatgpt-reverse-pkg
    ```

    **4. Copy the ZIP File(s) from the Container to Your Host:**

    ```bash
    # Copy the entire dist directory content
    docker cp extractor_container:/app/dist/. ./dist/
    ```
    *Replace `/app/dist/.` with the actual path inside your container where the ZIP files are generated.*

    **5. Check Ownership (If needed):**

    ```bash
    ls -l ./dist
    # If owned by root:
    # sudo chown -R $(whoami):$(whoami) ./dist
    ```

    **6. Remove the Temporary Container:**

    ```bash
    docker rm extractor_container
    ```

## Linting and Formatting

This project uses Biome for linting and formatting.

*   **Check formatting and linting:**
    ```bash
    pnpm biome check .
    # Or run separately:
    # pnpm biome format .
    # pnpm biome lint .
    ```
*   **Apply formatting and safe lint fixes:**
    ```bash
    pnpm biome check --apply .
    # Or run separately:
    # pnpm biome format --write .
    # pnpm biome lint --apply .
    ```

## Testing

*   **Run all tests:**
    ```bash
    pnpm test
    ```
*   **Run tests in watch mode:**
    ```bash
    pnpm test:watch
    ```

## License

This project is licensed under the ISC License. See the [LICENSE](./LICENSE) file for details.


