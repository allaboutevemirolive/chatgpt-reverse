// packages/service-worker/src/background.ts
import { initializeApp, FirebaseApp } from "firebase/app";
import {
    getAuth,
    onAuthStateChanged,
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";

import { VERSION } from "@shared";
import firebaseConfig from "./config/firebaseConfigs";
import { ChatGptApiClient } from "@/service/ChatGptApiClient";
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
} from "@/service/ChatGptService";
import {
    fetchConversationMessageIds,
    fetchConversationMessages,
    fetchConversationContext,
    fetchConversationAuthorCounts,
} from "@/service/ConversationProcessor";
import { exportConversationAsMarkdown } from "@/service/MarkdownExporter";
import { countConversationTokens } from "@/service/ConversationTokens";
// import ExtPay from 'extpay'; // Uncomment if using ExtPay

console.log("Service Worker starting...");
console.log("Shared Version:", VERSION);

// ============================================================================
// PAYMENT GATEWAY (Example - Uncomment and configure if needed)
// ============================================================================
// const extpay = ExtPay('chatgpt-reverse'); 
// extpay.startBackground();
// extpay.getUser().then(user => {
//     console.log("ExtensionPay User:", user);
// }).catch(err => {
//     console.error("Error getting ExtensionPay user:", err);
// });
// ============================================================================

// ============================================================================
// FIREBASE SETUP
// ============================================================================
let firebaseApp: FirebaseApp | null = null;
let currentUser: User | null = null; // Keep track of auth state globally

// --- Function to ensure Firebase is initialized ---
function ensureFirebaseInitialized(): FirebaseApp {
    if (!firebaseApp) {
        try {
            if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
                firebaseApp = initializeApp(firebaseConfig);
                console.log("Firebase initialized successfully in Service Worker.");
                setupAuthListener(); // Setup listener immediately after initialization
            } else {
                const errorMsg = "Firebase configuration is missing essential values. Check .env file.";
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error("Error initializing Firebase in Service Worker:", error);
            // Depending on your needs, you might want to prevent the extension
            // from working further or provide a degraded experience.
            throw error; // Rethrow if critical for extension function
        }
    }
    return firebaseApp;
}

// --- Function to get the initialized Firebase app ---
function getFirebaseApp(): FirebaseApp {
    // Ensures initialization happens if called before the top-level call completes
    return ensureFirebaseInitialized();
}

// --- Setup Auth State Listener ---
function setupAuthListener(): void {
    try {
        const auth = getAuth(getFirebaseApp()); // Get Auth instance from the initialized app
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("Service Worker: Auth state changed - User is signed in:", user.uid);
                currentUser = user;
                // Optionally notify other parts of the extension or update storage
                // chrome.storage.local.set({ authStatus: { isLoggedIn: true, uid: user.uid, email: user.email } });
            } else {
                console.log("Service Worker: Auth state changed - User is signed out.");
                currentUser = null;
                // chrome.storage.local.set({ authStatus: { isLoggedIn: false, uid: null, email: null } });
            }
        }, (error) => {
            console.error("Service Worker: Auth state listener error:", error);
            currentUser = null; // Assume logged out on listener error
            // chrome.storage.local.set({ authStatus: { isLoggedIn: false, uid: null, email: null, error: error.message } });
        });
        console.log("Service Worker: Firebase Auth listener attached.");
    } catch (error) {
        console.error("Service Worker: Failed to get Auth instance or setup listener:", error);
        // Handle cases where getAuth might fail (e.g., immediately after bad init)
        currentUser = null;
    }
}
// --- Initialize Firebase early ---
// Try to initialize as soon as the worker starts
try {
    ensureFirebaseInitialized();
} catch (e) {
    console.error("Initial Firebase initialization failed:", e);
    // Extension might not function correctly regarding auth/firebase features
}
// ============================================================================


// ============================================================================
// API CLIENT SETUP
// ============================================================================
// Initialize the API client (which loads headers from storage)
(async () => {
    try {
        // Ensure Firebase is initialized before potentially needing its auth state for API calls
        ensureFirebaseInitialized();
        // Now initialize the API client
        await ChatGptApiClient.initialize();
        console.log("Service Worker: ChatGptApiClient initialized successfully.");
    } catch (error) {
        console.error("Service Worker: Failed to initialize ChatGptApiClient:", error);
    }
})();
// ============================================================================


// ============================================================================
// HEADER STORAGE
// ============================================================================
async function storeHeaders(headersToStore: any): Promise<void> {
    if (!headersToStore || Object.keys(headersToStore).length === 0) {
        console.log("Service Worker (storeHeaders): No headers provided to store.");
        return;
    }
    try {
        const currentData = await chrome.storage.local.get("apiHeaders");
        // Filter out any null/undefined values from the incoming headers
        const filteredHeaders = Object.entries(headersToStore)
            .filter(([_, value]) => value !== null && value !== undefined)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {} as Record<string, any>);

        if (Object.keys(filteredHeaders).length === 0) {
            console.log("Service Worker (storeHeaders): Headers object became empty after filtering null/undefined.");
            return;
        }

        const mergedHeaders = { ...(currentData.apiHeaders || {}), ...filteredHeaders };
        await chrome.storage.local.set({ apiHeaders: mergedHeaders });
        console.log("Service Worker (storeHeaders): Headers updated in storage:", mergedHeaders);

        // Update the singleton API client instance immediately
        ChatGptApiClient.getInstance().setHeaders(mergedHeaders);

    } catch (error) {
        console.error("Service Worker (storeHeaders): Error storing/updating headers", error);
    }
}
// ============================================================================


// ============================================================================
// MESSAGE LISTENER
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const messageType = message?.type ?? "[Unknown Type]";
    console.log(
        `Service Worker received message: ${messageType}`,
        message?.payload ?? "[No payload]",
        `From: ${sender.tab ? `Tab ${sender.tab.id} (${sender.origin || sender.url})` : `Extension context (${sender.id})`}`,
    );

    // --- Ensure Firebase is ready for relevant actions ---
    // We do this check early. If Firebase is needed and failed, we respond immediately.
    let isFirebaseReady = true;
    if (messageType.startsWith("FETCH_") || messageType.startsWith("GET_") || messageType.startsWith("MARK_") || messageType.startsWith("EXPORT_") || messageType.startsWith("COUNT_") || ["REGISTER_USER", "LOGIN_USER", "LOGOUT_USER", "GET_AUTH_STATE", "DELETE_CONVERSATION", "SHARE_CONVERSATION", "ARCHIVE_CONVERSATION", "RENAME_CONVERSATION", "GENERATE_AUTOCOMPLETIONS", "SEND_COPY_FEEDBACK"].includes(messageType)) {
        try {
            ensureFirebaseInitialized(); // Make sure initialization has been attempted
            if (!firebaseApp) { // Check if it succeeded
                throw new Error("Firebase App instance is not available.");
            }
        } catch (initError) {
            console.error(`Firebase initialization check failed for message type ${messageType}:`, initError);
            isFirebaseReady = false;
            sendResponse({
                success: false,
                error: {
                    name: "FirebaseError",
                    message: `Firebase initialization failed or app not available: ${(initError as Error).message}`,
                },
            });
            return true; // Indicate async response even though we failed early
        }
    }

    if (!isFirebaseReady) {
        // If the above check failed and sent a response, we should stop processing here.
        return true;
    }


    // --- Helper for handling async operations and sending responses ---
    const handleAsync = async (asyncFn: () => Promise<any>) => {
        try {
            // Ensure the API client has the latest headers before executing the function
            // This adds robustness, especially if headers were updated recently
            await ChatGptApiClient.getInstance().refreshHeadersFromStorage();

            const result = await asyncFn();
            if (!sender.tab && !sender.id?.includes('popup')) { // Avoid logging potentially large data from content scripts often
                console.log(`Service Worker: Successfully handled ${messageType}. Result snippet:`, JSON.stringify(result)?.substring(0, 100) + "...");
            } else {
                console.log(`Service Worker: Successfully handled ${messageType}.`);
            }
            sendResponse({ success: true, data: result });
        } catch (error: any) {
            console.error(`Service Worker: Error handling ${messageType}:`, error);
            sendResponse({
                success: false,
                error: {
                    message: error.message || "An unknown error occurred in the service worker.",
                    name: error.name || "Error",
                    stack: error.stack, // Include stack for debugging
                },
            });
        }
    };

    // --- Message Handling Logic ---
    switch (messageType) {
        // --- Interceptor Messages ---
        case "HEADERS_RECEIVED":
            // Fire-and-forget is okay here, but using handleAsync ensures errors are logged if storage fails
            handleAsync(() => storeHeaders(message.data));
            break;
        case "AUTH_RECEIVED":
            handleAsync(async () => {
                await storeHeaders({ Authorization: `Bearer ${message.data.accessToken}` });
                // Also store the raw auth data if needed elsewhere
                await chrome.storage.local.set({ authData: message.data });
            });
            break;
        case "ACCOUNT_RECEIVED":
        case "CONVERSATION_LIMIT_RECEIVED":
        case "MODELS_RECEIVED":
            // Simple storage updates
            handleAsync(() => chrome.storage.local.set({ [messageType]: message.data }));
            break;

        // --- New Authentication Messages ---
        case "REGISTER_USER":
            handleAsync(async () => {
                const { email, password } = message.payload;
                if (!email || !password) throw new Error("Email and password are required for registration.");
                const auth = getAuth(getFirebaseApp());
                // SECURITY NOTE: Direct client-side registration is less secure than
                // using a backend/Cloud Function. Use with caution or for simple scenarios.
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log("Service Worker: User registered successfully", userCredential.user.uid);
                // Return minimal user info, don't expose the full credential
                return { uid: userCredential.user.uid, email: userCredential.user.email };
            });
            break;
        case "LOGIN_USER":
            handleAsync(async () => {
                const { email, password } = message.payload;
                if (!email || !password) throw new Error("Email and password are required for login.");
                const auth = getAuth(getFirebaseApp());
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("Service Worker: User logged in successfully", userCredential.user.uid);
                return { uid: userCredential.user.uid, email: userCredential.user.email };
            });
            break;
        case "LOGOUT_USER":
            handleAsync(async () => {
                const auth = getAuth(getFirebaseApp());
                await signOut(auth);
                console.log("Service Worker: User logged out.");
                return { message: "User logged out successfully." };
            });
            break;
        case "GET_AUTH_STATE":
            // Respond synchronously with the cached state
            console.log("Service Worker: Responding to GET_AUTH_STATE with:", currentUser);
            sendResponse({ success: true, data: currentUser ? { uid: currentUser.uid, email: currentUser.email } : null });
            // IMPORTANT: Return false for synchronous responses
            return false;

        // --- Existing API Call Messages ---
        case "FETCH_CONVERSATIONS":
            handleAsync(() =>
                fetchConversations(
                    message.payload?.offset, // Use optional chaining and provide defaults
                    message.payload?.limit,
                    message.payload?.order,
                ),
            );
            break;
        case "FETCH_CONVERSATION":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(() => fetchConversation(message.payload.conversationId));
            break;
        case "DELETE_CONVERSATION":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(() => deleteConversation(message.payload.conversationId));
            break;
        case "SHARE_CONVERSATION":
            if (!message.payload?.conversationId || !message.payload?.currentNodeId) return handleAsync(() => Promise.reject(new Error("Missing conversationId or currentNodeId")));
            handleAsync(() => shareConversation(message.payload.conversationId, message.payload.currentNodeId));
            break;
        case "ARCHIVE_CONVERSATION":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(() => archiveConversation(message.payload.conversationId));
            break;
        case "RENAME_CONVERSATION":
            if (!message.payload?.conversationId || !message.payload?.newTitle) return handleAsync(() => Promise.reject(new Error("Missing conversationId or newTitle")));
            handleAsync(() => renameConversation(message.payload.conversationId, message.payload.newTitle));
            break;
        case "GENERATE_AUTOCOMPLETIONS":
            if (message.payload?.inputText === undefined || message.payload?.inputText === null) return handleAsync(() => Promise.reject(new Error("Missing inputText")));
            handleAsync(() =>
                generateAutocompletions(
                    message.payload.inputText,
                    message.payload.numCompletions,
                    message.payload.inSearchMode,
                ),
            );
            break;
        case "SEND_COPY_FEEDBACK":
            if (!message.payload?.messageId || !message.payload?.conversationId || message.payload?.selectedText === undefined) return handleAsync(() => Promise.reject(new Error("Missing messageId, conversationId, or selectedText")));
            handleAsync(() =>
                sendCopyFeedback(
                    message.payload.messageId,
                    message.payload.conversationId,
                    message.payload.selectedText,
                ),
            );
            break;
        case "GET_AUDIO":
            if (!message.payload?.messageId || !message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing messageId or conversationId")));
            handleAsync(async () => {
                const blob = await getAudioForMessage(
                    message.payload.messageId,
                    message.payload.conversationId,
                    message.payload.voice,
                    message.payload.format,
                );
                // Convert Blob to Data URL for sending back
                const reader = new FileReader();
                const dataUrlPromise = new Promise<string>((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(blob);
                });
                try {
                    const dataUrl = await dataUrlPromise;
                    console.log(`Service Worker: Generated Data URL (length: ${dataUrl?.length ?? 0}) for audio.`);
                    return {
                        dataUrl,
                        format: message.payload.format || "aac",
                        messageId: message.payload.messageId,
                    };
                } catch (error) {
                    console.error("Service Worker: Error converting Blob to Data URL", error);
                    throw new Error("Failed to read audio blob data.");
                }
            });
            break;
        case "MARK_MESSAGE_THUMBS_UP":
            if (!message.payload?.messageId || !message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing messageId or conversationId")));
            handleAsync(() => markMessageAsThumbsUp(message.payload.messageId, message.payload.conversationId));
            break;
        case "MARK_MESSAGE_THUMBS_DOWN":
            if (!message.payload?.messageId || !message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing messageId or conversationId")));
            handleAsync(() => markMessageAsThumbsDown(message.payload.messageId, message.payload.conversationId));
            break;

        case "FETCH_CONVERSATION_MESSAGE_IDS":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(() => fetchConversationMessageIds(message.payload.conversationId));
            break;
        case "FETCH_CONVERSATION_MESSAGES":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(() => fetchConversationMessages(message.payload.conversationId));
            break;
        case "FETCH_CONVERSATION_CONTEXT":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(() => fetchConversationContext(message.payload.conversationId));
            break;
        case "FETCH_CONVERSATION_AUTHOR_COUNTS":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(() => fetchConversationAuthorCounts(message.payload.conversationId));
            break;

        case "EXPORT_CONVERSATION_MARKDOWN":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(async () => {
                // Fetch and format markdown content
                const exportData = await exportConversationAsMarkdown(message.payload.conversationId);
                // Return the necessary data for the content script to trigger download
                return {
                    markdownContent: exportData.markdownContent,
                    createTime: exportData.createTime,
                    title: exportData.title,
                };
            });
            break;

        case "COUNT_CONVERSATION_TOKENS":
            if (!message.payload?.conversationId) return handleAsync(() => Promise.reject(new Error("Missing conversationId")));
            handleAsync(() => countConversationTokens(message.payload.conversationId, message.payload.model));
            break;

        // --- Other Utilities (Example: Get Cookie) ---
        case "GET_COOKIE":
            if (!message.payload?.name || !message.payload?.url) {
                sendResponse({ success: false, error: { message: "Missing cookie name or url" } });
                return false; // Sync response
            }
            chrome.cookies.get({ name: message.payload.name, url: message.payload.url }, (cookie) => {
                if (chrome.runtime.lastError) {
                    console.error("Error getting cookie:", chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: { message: chrome.runtime.lastError.message } });
                } else {
                    sendResponse({ success: true, data: { value: cookie?.value || null } });
                }
            });
            // Return true because the callback is async
            return true;

        // --- Default Case ---
        default:
            console.warn(`Service Worker received unknown message type: ${messageType}`);
            sendResponse({
                success: false,
                error: { message: `Unknown message type '${messageType}' received.` },
            });
            // Return false because we responded synchronously
            return false;
    }

    // IMPORTANT: Return true to indicate that the response will be sent asynchronously
    // for all cases handled by `handleAsync` or other async callbacks (like chrome.cookies.get).
    return true;
});
// ============================================================================


// ============================================================================
// LIFECYCLE LISTENERS
// ============================================================================
chrome.runtime.onInstalled.addListener((details) => {
    console.log(
        `Service Worker: Extension ${details.reason}. Previous version: ${details.previousVersion}. Current version: ${VERSION}`,
    );
    // Perform setup tasks on install/update if needed
    // e.g., set default settings in storage
});

chrome.runtime.onStartup.addListener(async () => {
    console.log("Service Worker: Browser startup detected. Activating.");
    // Re-initialize things that might depend on browser state or need refreshing
    try {
        ensureFirebaseInitialized(); // Ensure Firebase is ready
        await ChatGptApiClient.initialize(); // Re-load headers for API client
        console.log("Service Worker: Refreshed configurations on browser startup.");
    } catch (error) {
        console.error("Service Worker: Error during onStartup initialization:", error);
    }
});
// ============================================================================

console.log("Service Worker: Event listeners attached and setup complete.");
