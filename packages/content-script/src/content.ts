// packages/content-script/src/content.ts
import { createGreeting } from "@shared";
import { WindowMain } from "./ui/WindowMain";

console.log("Content script starting execution...");

/**
 * Initializes the main UI window for the extension.
 * Should only run once the DOM is ready.
 */
function initializeExtensionUI() {
    console.log("DOM ready, attempting to initialize WindowMain...");
    try {
        // Initialize the singleton instance of the main window UI.
        // This static method creates the instance if it doesn't exist
        // or returns the existing one.
        WindowMain.initialize();

        // You don't usually need to store the returned instance here unless
        // you need to call public methods on it directly from content.ts,
        // which is less common for a UI manager like this.
        // Example: const windowInstance = WindowMain.initialize();
        // windowInstance.show(); // You could call public methods if needed

        console.log("WindowMain initialization requested successfully.");
    } catch (error) {
        console.error(
            "Content script: Failed during WindowMain initialization.",
            error,
        );
        // Handle initialization errors, maybe show a notification
        // or log more details depending on the expected failure modes.
    }
}

// --- Wait for DOM Ready ---
// Check if the DOM is already loaded. If not, wait for the DOMContentLoaded event.
// This is important because WindowMain appends elements to document.body.
if (document.readyState === "loading") {
    // Loading hasn't finished yet
    document.addEventListener("DOMContentLoaded", initializeExtensionUI);
} else {
    // `DOMContentLoaded` has already fired
    initializeExtensionUI();
}

// --- Existing example code (can be kept or removed as needed) ---
const message = createGreeting("Content Script User");
console.log("Shared message:", message.text);

// Add any other content script logic here...
// This code will run immediately, potentially before the DOM is fully ready,
// unless it's placed inside the initializeExtensionUI function or the
// DOMContentLoaded listener.
