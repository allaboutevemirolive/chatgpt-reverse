// packages/content-script/src/content.ts
import { WindowMain } from "./ui/WindowMain";

console.log("Content script starting execution...");

function initializeExtensionUI() {
    console.log("DOM ready, attempting to initialize WindowMain...");
    try {
        WindowMain.initialize();

        console.log("WindowMain initialization requested successfully.");
    } catch (error) {
        console.error(
            "Content script: Failed during WindowMain initialization.",
            error,
        );
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeExtensionUI);
} else {
    initializeExtensionUI();
}
