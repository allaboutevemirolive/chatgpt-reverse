// packages/service-worker/src/background.ts
import { VERSION } from '@shared';

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed!');
});

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     console.log('Message received in background:', message);
//     // Handle messages from content scripts or popup
//     if (message.type === 'GREETING') {
//         sendResponse({ farewell: 'Goodbye from background!' });
//     }
//     return true; // Indicates asynchronous response potentially
// });

// src/background.ts

// --- Core Dependencies ---
import { ChatGptApiClient } from "@/service/ChatGptApiClient";

// --- Service Function Imports (Corrected Paths) ---
import {
    fetchConversations,
    deleteConversation,
    shareConversation,
    fetchConversation,
    archiveConversation,
    renameConversation,
    generateAutocompletions,
    sendCopyFeedback,
    getAudioForMessage,
    markMessageAsThumbsUp,
    markMessageAsThumbsDown,
} from "@/service/chatGptUtils";

import {
    fetchConversationMessageIds,
    fetchConversationMessages,
    fetchConversationContext,
    fetchConversationAuthorCounts,
} from "@/service/conversationUtils";

import { exportConversationAsMarkdown } from "@/service/markdownExporter";

import { countConversationTokens } from "@/service/conversationTokenCounter";

// --- Initialization & Logging ---
// Optionally include shared version if needed, ensure '@shared' path is configured correctly
// import { VERSION } from '@shared';
console.log('Shared Version:', VERSION);
console.log("Service Worker starting...");

// --- Initialize ChatGptApiClient ---
// Wrap initialization in an async IIFE
(async () => {
    try {
        // Initialize the singleton instance and load initial headers from storage.
        // ChatGptApiClient.initialize() handles getting the instance and calling setHeaders internally.
        await ChatGptApiClient.initialize(); // Use renamed class
        console.log(
            "Service Worker: ChatGptApiClient initialized successfully.",
        );
    } catch (error) {
        console.error(
            "Service Worker: Failed to initialize ChatGptApiClient:",
            error,
        );
    }
})();

// --- State Management (Headers/Tokens) ---
// Store headers in chrome.storage.local
async function storeHeaders(headers: any): Promise<void> {
    try {
        const currentData = await chrome.storage.local.get("apiHeaders");
        const mergedHeaders = { ...(currentData.apiHeaders || {}), ...headers };
        await chrome.storage.local.set({ apiHeaders: mergedHeaders });
        console.log("Service Worker: Headers stored", mergedHeaders);

        // Update the ChatGptApiClient singleton instance
        await ChatGptApiClient.getInstance().setHeaders(mergedHeaders); // Use renamed class
    } catch (error) {
        console.error("Service Worker: Error storing/updating headers", error);
    }
}

// Retrieve headers from storage
async function getStoredHeaders(): Promise<any> {
    try {
        const data = await chrome.storage.local.get("apiHeaders");
        return data.apiHeaders || {};
    } catch (error) {
        console.error("Service Worker: Error retrieving headers", error);
        return {};
    }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(
        `Service Worker received message: ${message.type}`,
        message.payload ?? "[No payload]",
        `From: ${sender.tab ? `Tab ${sender.tab.id}` : sender.id || "Unknown"}`,
    );

    // --- Interceptor Data Handling ---
    if (message.type === "HEADERS_RECEIVED") {
        storeHeaders(message.data).then(() => sendResponse({ success: true }));
        return true; // Indicates async response
    }
    if (message.type === "AUTH_RECEIVED") {
        storeHeaders({
            Authorization: `Bearer ${message.data.accessToken}`,
        }).then(() => {
            chrome.storage.local.set({ authData: message.data });
            sendResponse({ success: true });
        });
        return true; // Indicates async response
    }
    if (
        message.type === "ACCOUNT_RECEIVED" ||
        message.type === "CONVERSATION_LIMIT_RECEIVED" ||
        message.type === "MODELS_RECEIVED"
    ) {
        chrome.storage.local.set({ [message.type]: message.data }, () => {
            if (chrome.runtime.lastError) {
                console.error(
                    `Error storing ${message.type}:`,
                    chrome.runtime.lastError.message,
                );
                sendResponse({
                    success: false,
                    error: { message: chrome.runtime.lastError.message },
                });
            } else {
                sendResponse({ success: true });
            }
        });
        return true; // Storage set is async
    }

    // --- Content Script/Popup Action Handling ---
    const handleAsync = async (asyncFn: () => Promise<any>) => {
        try {
            // Optional: Refresh headers from storage before critical operations if needed.
            // await ChatGptApiClient.getInstance().refreshHeadersFromStorage(); // Use renamed class

            const result = await asyncFn();
            sendResponse({ success: true, data: result });
        } catch (error: any) {
            console.error(
                `Service Worker Error handling ${message.type}:`,
                error,
            );
            sendResponse({
                success: false,
                error: {
                    message: error.message || "An unknown error occurred",
                    name: error.name,
                    stack: error.stack, // Useful for debugging
                },
            });
        }
    };

    // Route messages to appropriate handlers
    switch (message.type) {
        // --- Data Fetching/Manipulation (from chatGptUtils) ---
        case "FETCH_CONVERSATIONS":
            handleAsync(() =>
                fetchConversations(
                    message.payload.offset,
                    message.payload.limit,
                    message.payload.order,
                ),
            );
            break;
        case "FETCH_CONVERSATION": // This now comes from chatGptUtils
            handleAsync(() =>
                fetchConversation(message.payload.conversationId),
            );
            break;
        case "DELETE_CONVERSATION":
            handleAsync(() =>
                deleteConversation(message.payload.conversationId),
            );
            break;
        case "SHARE_CONVERSATION":
            handleAsync(() =>
                shareConversation(
                    message.payload.conversationId,
                    message.payload.currentNodeId,
                ),
            );
            break;
        case "ARCHIVE_CONVERSATION":
            handleAsync(() =>
                archiveConversation(message.payload.conversationId),
            );
            break;
        case "RENAME_CONVERSATION":
            handleAsync(() =>
                renameConversation(
                    message.payload.conversationId,
                    message.payload.newTitle,
                ),
            );
            break;
        case "GENERATE_AUTOCOMPLETIONS":
            handleAsync(() =>
                generateAutocompletions(
                    message.payload.inputText,
                    message.payload.numCompletions,
                    message.payload.inSearchMode,
                ),
            );
            break;
        case "SEND_COPY_FEEDBACK":
            handleAsync(() =>
                sendCopyFeedback(
                    message.payload.messageId,
                    message.payload.conversationId,
                    message.payload.selectedText,
                ),
            );
            break;
        case "GET_AUDIO":
            handleAsync(async () => {
                const blob = await getAudioForMessage(
                    message.payload.messageId,
                    message.payload.conversationId,
                    message.payload.voice,
                    message.payload.format,
                );
                const reader = new FileReader();
                const dataUrlPromise = new Promise<string>(
                    (resolve, reject) => {
                        reader.onloadend = () =>
                            resolve(reader.result as string);
                        reader.onerror = (error) => reject(error);
                        reader.readAsDataURL(blob);
                    },
                );
                try {
                    const dataUrl = await dataUrlPromise;
                    console.log(
                        `Service Worker: Generated Data URL (length: ${dataUrl.length}) for audio.`,
                    );
                    return {
                        dataUrl,
                        format: message.payload.format || "aac",
                        messageId: message.payload.messageId,
                    };
                } catch (error) {
                    console.error(
                        "Service Worker: Error converting Blob to Data URL",
                        error,
                    );
                    throw new Error("Failed to read audio blob data.");
                }
            });
            break;
        case "MARK_MESSAGE_THUMBS_UP":
            handleAsync(() =>
                markMessageAsThumbsUp(
                    message.payload.messageId,
                    message.payload.conversationId,
                ),
            );
            break;
        case "MARK_MESSAGE_THUMBS_DOWN":
            handleAsync(() =>
                markMessageAsThumbsDown(
                    message.payload.messageId,
                    message.payload.conversationId,
                ),
            );
            break;

        // --- Conversation Processing/Analysis (from conversationUtils) ---
        case "FETCH_CONVERSATION_MESSAGE_IDS":
            handleAsync(() =>
                fetchConversationMessageIds(message.payload.conversationId),
            );
            break;
        case "FETCH_CONVERSATION_MESSAGES":
            handleAsync(() =>
                fetchConversationMessages(message.payload.conversationId),
            );
            break;
        case "FETCH_CONVERSATION_CONTEXT":
            handleAsync(() =>
                fetchConversationContext(message.payload.conversationId),
            );
            break;
        case "FETCH_CONVERSATION_AUTHOR_COUNTS":
            handleAsync(() =>
                fetchConversationAuthorCounts(message.payload.conversationId),
            );
            break;

        // --- Exporting (from markdownExporter) ---
        case "EXPORT_CONVERSATION_MARKDOWN":
            handleAsync(async () => {
                const exportData = await exportConversationAsMarkdown(
                    message.payload.conversationId,
                );
                return {
                    markdownContent: exportData.markdownContent,
                    createTime: exportData.createTime,
                    title: exportData.title,
                };
            });
            break;

        // --- Token Counting (from conversationTokenCounter) ---
        case "COUNT_CONVERSATION_TOKENS":
            handleAsync(() =>
                countConversationTokens(
                    message.payload.conversationId,
                    message.payload.model,
                ),
            );
            break;

        // --- Browser API Interaction ---
        case "GET_COOKIE":
            chrome.cookies.get(
                {
                    name: message.payload.name,
                    url: message.payload.url,
                },
                (cookie) => {
                    if (chrome.runtime.lastError) {
                        console.error(
                            "Error getting cookie:",
                            chrome.runtime.lastError.message,
                        );
                        sendResponse({
                            success: false,
                            error: {
                                message: chrome.runtime.lastError.message,
                            },
                        });
                    } else {
                        sendResponse({
                            success: true,
                            data: { value: cookie?.value || null },
                        });
                    }
                },
            );
            return true; // Indicates async response

        // --- Default ---
        default:
            console.warn(
                "Service Worker received unknown message type:",
                message.type,
            );
            // Optionally send a response for unknown types
            sendResponse({
                success: false,
                error: {
                    message: `Unknown message type '${message.type}' received by service worker.`,
                },
            });
            // Return false as we handled it synchronously (by sending an error response)
            // and are not waiting for any further async operation for this unknown type.
            return false;
    }

    // Return true for all cases handled by handleAsync,
    // as it manages the asynchronous response sending.
    return true;
});

// --- Service Worker Lifecycle Listeners ---
chrome.runtime.onInstalled.addListener((details) => {
    console.log(
        `Extension ${details.reason}. Previous version: ${details.previousVersion}. Service worker active.`,
    );
    // Example: Clear storage on install or update if needed
    // if (details.reason === "install" || details.reason === "update") {
    //     chrome.storage.local.clear(() => {
    //         console.log("Cleared local storage on install/update.");
    //     });
    // }
});

chrome.runtime.onStartup.addListener(async () => {
    console.log("Browser startup detected. Service worker activating.");
    // Ensure headers are loaded into the ChatGptApiClient instance
    try {
        // Re-initialize to load fresh headers from storage,
        // ensuring the singleton instance is up-to-date.
        await ChatGptApiClient.initialize(); // Use renamed class
        console.log(
            "Service Worker: ChatGptApiClient headers refreshed on browser startup.",
        );
    } catch (error) {
        console.error(
            "Service Worker: Failed to refresh ChatGptApiClient headers on browser startup:",
            error,
        );
    }
});

console.log("Service Worker event listeners attached.");

