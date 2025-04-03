// packages/service-worker/src/background.ts
import { VERSION } from '@shared'; // Example import

console.log('Service Worker loaded!');
console.log('Shared Version:', VERSION); // Example using shared

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed!');
    // Add initialization logic here (e.g., setting alarms, context menus)
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received in background:', message);
    // Handle messages from content scripts or popup
    if (message.type === 'GREETING') {
        sendResponse({ farewell: 'Goodbye from background!' });
    }
    return true; // Indicates asynchronous response potentially
});

// Other service worker logic...
