// src/background.ts
import { VERSION } from "@shared";
import { initializeFirebase } from "@/firebase/core";
import { setupAuthListener, registerUser, loginUser, logoutUser, getAuthState, awaitAuthReady, resetAuthReadyPromise } from "@/firebase/auth";
import { createCheckoutSession } from "@/firebase/stripe";
import { ChatGptApiClient } from "@/service/ChatGptApiClient";
import * as ChatGptService from "@/service/ChatGptService"; // Import all as namespace
import * as ConversationProcessor from "@/service/ConversationProcessor"; // Import all as namespace
import { exportConversationAsMarkdown } from "@/service/MarkdownExporter";
import { countConversationTokens } from "@/service/ConversationTokens";
import { STORAGE_API_HEADERS_KEY, STORAGE_AUTH_DATA_KEY } from "@/config/constants"; // Import constants

console.log("Service Worker starting...");
console.log("Shared Version:", VERSION);

// ============================================================================
// INITIALIZATION
// ============================================================================

try {
    initializeFirebase(); // Initialize Firebase core services
    setupAuthListener(); // Setup the listener *after* core init
    console.log("SW: Firebase Initialized and Auth Listener Setup requested.");
} catch (e) {
    console.error("SW: Critical Firebase initialization failed:", e);
    // Depending on the error, may want to disable features
}

// Initialize API Client (async, happens in background)
(async () => {
    try {
        // Firebase should be initialized by now, but awaitAuthReady ensures listener is active
        await awaitAuthReady();
        await ChatGptApiClient.initialize();
        console.log("SW: ChatGptApiClient initialized after auth ready.");
    } catch (error) {
        console.error("SW: Failed to initialize ChatGptApiClient:", error);
    }
})();


// ============================================================================
// HEADER STORAGE HELPER
// ============================================================================
async function storeHeaders(headersToStore: any): Promise<void> {
    // (Keep the storeHeaders function as it was, but use constants for keys)
    if (!headersToStore || Object.keys(headersToStore).length === 0) {
        return;
    }
    try {
        const currentData = await chrome.storage.local.get(STORAGE_API_HEADERS_KEY);
        const filteredHeaders = Object.entries(headersToStore)
            .filter(([_, value]) => value !== null && value !== undefined)
            .reduce(
                (obj, [key, value]) => {
                    obj[key] = value as string;
                    return obj;
                },
                {} as Record<string, string>,
            );

        if (Object.keys(filteredHeaders).length === 0) return;

        const mergedHeaders = {
            ...(currentData[STORAGE_API_HEADERS_KEY] || {}),
            ...filteredHeaders,
        };
        await chrome.storage.local.set({ [STORAGE_API_HEADERS_KEY]: mergedHeaders });

        // Update the API client instance immediately
        ChatGptApiClient.getInstance().setHeaders(mergedHeaders);
    } catch (error) {
        console.error("SW (storeHeaders): Error storing/updating headers", error);
    }
}
// ============================================================================

// ============================================================================
// MESSAGE LISTENER
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const messageType = message?.type ?? "[Unknown Type]";
    const senderId = sender.tab ? `Tab ${sender.tab.id}` : sender.id || "Unknown";
    console.log(`SW received: ${messageType} from ${senderId}`, message.payload ? `with payload` : "");

    // --- Async Handler Wrapper ---
    const handleAsync = async (asyncFn: () => Promise<any>) => {
        try {
            // Ensure Firebase Auth state is ready for operations needing it
            // (e.g., checkout, potentially some API calls if they depended on user ID implicitly)
            if (["CREATE_CHECKOUT_SESSION"].includes(messageType)) { // Add other types if needed
                console.log(`SW: Awaiting auth ready for ${messageType}...`);
                await awaitAuthReady();
                console.log(`SW: Auth ready for ${messageType}. Proceeding.`);
            }

            // Refresh API client headers just before making direct ChatGPT API calls
            if (messageType.startsWith("FETCH_") || messageType.startsWith("GET_AUDIO") || messageType.startsWith("MARK_") || messageType.startsWith("SHARE_") || messageType.startsWith("ARCHIVE_") || messageType.startsWith("RENAME_") || messageType.startsWith("GENERATE_") || messageType.startsWith("SEND_") || messageType === "EXPORT_CONVERSATION_MARKDOWN" || messageType === "COUNT_CONVERSATION_TOKENS") {
                console.log(`SW: Refreshing API headers before ${messageType}`);
                await ChatGptApiClient.getInstance().refreshHeadersFromStorage();
            }

            const result = await asyncFn();
            console.log(`SW: Successfully handled ${messageType}.`);
            sendResponse({ success: true, data: result });
        } catch (error: any) {
            console.error(`SW: Error handling ${messageType}:`, error);
            sendResponse({
                success: false,
                error: {
                    name: error.name || "Error",
                    message: error.message || "An unknown error occurred.",
                    stack: error.stack,
                },
            });
        }
    };

    // --- Message Handling Logic ---
    switch (messageType) {
        // --- Interceptor Data ---
        case "HEADERS_RECEIVED":
            handleAsync(() => storeHeaders(message.data));
            break;
        case "AUTH_RECEIVED":
            // Store auth token specifically if needed, and also update headers
            handleAsync(async () => {
                await storeHeaders({ Authorization: `Bearer ${message.data.accessToken}` });
                await chrome.storage.local.set({ [STORAGE_AUTH_DATA_KEY]: message.data }); // Use constant key
            });
            break;
        // Generic storage for other intercepted data
        case "ACCOUNT_RECEIVED":
        case "CONVERSATION_LIMIT_RECEIVED":
        case "MODELS_RECEIVED":
            handleAsync(() => chrome.storage.local.set({ [messageType]: message.data }));
            break;

        // --- Authentication (Delegated) ---
        case "REGISTER_USER":
            handleAsync(() => registerUser(message.payload.email, message.payload.password));
            break;
        case "LOGIN_USER":
            handleAsync(() => loginUser(message.payload.email, message.payload.password));
            break;
        case "LOGOUT_USER":
            handleAsync(logoutUser);
            break;
        case "GET_AUTH_STATE":
            // Wait for initial state then return cached state
            handleAsync(async () => {
                console.log("SW: GET_AUTH_STATE awaiting auth ready promise...");
                await awaitAuthReady(); // Ensure listener has fired at least once
                console.log("SW: GET_AUTH_STATE promise resolved, returning current state.");
                return getAuthState(); // Return the synchronous state
            });
            break;

        // --- Stripe (Delegated) ---
        case "CREATE_CHECKOUT_SESSION":
            if (!message.payload?.planId || !['monthly', 'lifetime'].includes(message.payload.planId)) {
                sendResponse({ success: false, error: { message: "Invalid or missing planId in payload" } });
                return false; // Sync validation fail
            }
            handleAsync(() => createCheckoutSession(message.payload));
            break;

        // --- ChatGPT API Wrappers (Delegated) ---
        case "FETCH_CONVERSATIONS": handleAsync(() => ChatGptService.fetchConversations(message.payload?.offset, message.payload?.limit, message.payload?.order)); break;
        case "FETCH_CONVERSATION": handleAsync(() => ChatGptService.fetchConversation(message.payload.conversationId)); break;
        case "DELETE_CONVERSATION": handleAsync(() => ChatGptService.deleteConversation(message.payload.conversationId)); break;
        case "SHARE_CONVERSATION": handleAsync(() => ChatGptService.shareConversation(message.payload.conversationId, message.payload.currentNodeId)); break;
        case "ARCHIVE_CONVERSATION": handleAsync(() => ChatGptService.archiveConversation(message.payload.conversationId)); break;
        case "RENAME_CONVERSATION": handleAsync(() => ChatGptService.renameConversation(message.payload.conversationId, message.payload.newTitle)); break;
        case "GENERATE_AUTOCOMPLETIONS": handleAsync(() => ChatGptService.generateAutocompletions(message.payload.inputText, message.payload.numCompletions, message.payload.inSearchMode)); break;
        case "SEND_COPY_FEEDBACK": handleAsync(() => ChatGptService.sendCopyFeedback(message.payload.messageId, message.payload.conversationId, message.payload.selectedText)); break;
        case "GET_AUDIO": handleAsync(async () => { const blob = await ChatGptService.getAudioForMessage(message.payload.messageId, message.payload.conversationId, message.payload.voice, message.payload.format); const reader = new FileReader(); const dataUrl = await new Promise<string>((resolve, reject) => { reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); }); return { dataUrl, format: message.payload.format || "aac", messageId: message.payload.messageId }; }); break;
        case "MARK_MESSAGE_THUMBS_UP": handleAsync(() => ChatGptService.markMessageAsThumbsUp(message.payload.messageId, message.payload.conversationId)); break;
        case "MARK_MESSAGE_THUMBS_DOWN": handleAsync(() => ChatGptService.markMessageAsThumbsDown(message.payload.messageId, message.payload.conversationId)); break;

        // --- Conversation Processing (Delegated) ---
        case "FETCH_CONVERSATION_MESSAGE_IDS": handleAsync(() => ConversationProcessor.fetchConversationMessageIds(message.payload.conversationId)); break;
        case "FETCH_CONVERSATION_MESSAGES": handleAsync(() => ConversationProcessor.fetchConversationMessages(message.payload.conversationId)); break;
        case "FETCH_CONVERSATION_CONTEXT": handleAsync(() => ConversationProcessor.fetchConversationContext(message.payload.conversationId)); break;
        case "FETCH_CONVERSATION_AUTHOR_COUNTS": handleAsync(() => ConversationProcessor.fetchConversationAuthorCounts(message.payload.conversationId)); break;
        case "EXPORT_CONVERSATION_MARKDOWN": handleAsync(() => exportConversationAsMarkdown(message.payload.conversationId)); break;
        case "COUNT_CONVERSATION_TOKENS": handleAsync(() => countConversationTokens(message.payload.conversationId, message.payload.model)); break;

        // --- Other Utilities ---
        case "GET_COOKIE":
            // Keep simple utilities directly here if preferred
            if (!message.payload?.name || !message.payload?.url) {
                sendResponse({ success: false, error: { message: "Missing cookie name or url" } });
                return false;
            }
            chrome.cookies.get(
                { name: message.payload.name, url: message.payload.url },
                (cookie) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: { message: chrome.runtime.lastError.message } });
                    } else {
                        sendResponse({ success: true, data: { value: cookie?.value || null } });
                    }
                },
            );
            return true; // Indicate async

        default:
            console.warn(`SW: Unknown message type received: ${messageType}`);
            sendResponse({ success: false, error: { message: `Unknown message type '${messageType}'.` } });
            return false; // Sync response for unknown type
    }

    // Indicate that we *might* send a response asynchronously for handled cases
    return true;
});
// ============================================================================


// ============================================================================
// LIFECYCLE LISTENERS
// ============================================================================
chrome.runtime.onInstalled.addListener((details) => {
    console.log(`SW: Extension ${details.reason}. v${VERSION}. Prev: ${details.previousVersion || "N/A"}`);
    resetAuthReadyPromise(); // Reset the promise on install/update
    // Consider calling initializeFirebase() here if needed, although it should run on first access
});

chrome.runtime.onStartup.addListener(async () => {
    console.log("SW: Browser startup. Re-initializing...");
    resetAuthReadyPromise(); // Reset the promise on browser startup
    try {
        initializeFirebase(); // Ensure Firebase core is ready
        setupAuthListener(); // Ensure listener is attached
        await ChatGptApiClient.initialize(); // Refresh API client headers
        console.log("SW: Refreshed configurations on startup.");
    } catch (error) {
        console.error("SW: Error during onStartup initialization:", error);
    }
});
// ============================================================================

console.log("SW: Event listeners attached.");
