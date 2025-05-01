// packages/service-worker/src/background.ts
import { initializeApp, FirebaseApp } from "firebase/app";
import {
    getAuth,
    onAuthStateChanged,
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    Auth, // Import Auth type
} from "firebase/auth";
import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    DocumentReference,
    DocumentData,
    FirestoreError, // Import FirestoreError type
    Firestore, // Import Firestore type
    Unsubscribe, // Import Unsubscribe type
} from "firebase/firestore";

import { VERSION } from "@shared"; // Assuming you export version from shared
import firebaseConfig from "./config/firebaseConfigs"; // Import the config object
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

console.log("Service Worker starting...");
console.log("Shared Version:", VERSION);

// ============================================================================
// CONSTANTS
// ============================================================================

// !!! REPLACE WITH YOUR ACTUAL STRIPE PRICE IDs !!!
// Find these in your Stripe Dashboard under Products > Your Product > Pricing
// It should look like 'price_xxxxxxxxxxxxxxx'
const STRIPE_PRICE_ID_MONTHLY = "prod_SEPe1ENlGWa5Jy"; // Example - REPLACE
const STRIPE_PRICE_ID_LIFETIME = "price_1PV38jJGLYV9XQh173aYJbQ5"; // Example - REPLACE

// Define Success/Cancel URLs (using the auth page which should handle these params)
const EXTENSION_BASE_URL = chrome.runtime.getURL("popup/auth.html");
// Stripe can optionally append session_id if {CHECKOUT_SESSION_ID} is in the URL
const CHECKOUT_SUCCESS_URL = `${EXTENSION_BASE_URL}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
const CHECKOUT_CANCEL_URL = `${EXTENSION_BASE_URL}?checkout=cancel`;
const CHECKOUT_LISTENER_TIMEOUT = 30000; // 30 seconds timeout for Stripe extension listener

// ============================================================================
// FIREBASE & AUTH STATE SETUP
// ============================================================================
let firebaseApp: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let firebaseAuthInstance: Auth | null = null;
let currentUser: User | null = null; // Cached user state

// Promise to track when the *initial* auth state is confirmed after SW startup
let authReadyResolver: ((value: User | null) => void) | null = null;
let authReadyPromise: Promise<User | null> | null = null;
let isAuthListenerAttached = false;

function initializeAuthReadyPromise() {
    authReadyPromise = new Promise<User | null>((resolve) => {
        authReadyResolver = resolve;
        console.log("SW: authReadyPromise created/recreated.");
    });
}
initializeAuthReadyPromise(); // Create the initial promise

// --- Function to ensure Firebase is initialized ---
function ensureFirebaseInitialized(): FirebaseApp {
    if (!firebaseApp) {
        console.log("SW: Attempting Firebase initialization...");
        try {
            if (
                firebaseConfig.apiKey &&
                firebaseConfig.projectId &&
                firebaseConfig.appId
            ) {
                firebaseApp = initializeApp(firebaseConfig);
                console.log("SW: Firebase App initialized.");
                // TODO: Change database name into const
                firestoreInstance = getFirestore(firebaseApp, 'chatgpt-reverse-db');
                console.log("SW: Firestore initialized.");
                firebaseAuthInstance = getAuth(firebaseApp);
                console.log("SW: Firebase Auth initialized.");

                if (!isAuthListenerAttached) {
                    // Ensure the promise is ready before attaching listener
                    if (!authReadyPromise) initializeAuthReadyPromise();
                    setupAuthListener(); // Attach listener only once per SW lifecycle
                }
            } else {
                const errorMsg =
                    "Firebase configuration is missing essential values.";
                console.error("SW:", errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error("SW: Error initializing Firebase:", error);
            firestoreInstance = null;
            firebaseAuthInstance = null;
            // Resolve the promise with null if initialization fails
            if (authReadyResolver) {
                authReadyResolver(null);
                authReadyResolver = null; // Prevent resolving again
            } else if (!authReadyPromise) {
                // If promise somehow became null, re-initialize and resolve
                initializeAuthReadyPromise();
                authReadyResolver!(null); // Should exist now
                authReadyResolver = null;
            }
            throw error;
        }
    }
    return firebaseApp;
}

// --- Function to get the initialized Firebase app ---
function getFirebaseApp(): FirebaseApp {
    return ensureFirebaseInitialized();
}

// --- Function to get the initialized Firestore instance ---
function getDb(): Firestore {
    ensureFirebaseInitialized(); // Ensures app and Firestore are initialized
    if (!firestoreInstance) {
        console.error("SW: getDb called but Firestore instance is null.");
        throw new Error("Firestore is not initialized.");
    }
    return firestoreInstance;
}

// --- Function to get the initialized Auth instance ---
function getFirebaseAuth(): Auth {
    ensureFirebaseInitialized(); // Ensures app and Auth are initialized
    if (!firebaseAuthInstance) {
        console.error(
            "SW: getFirebaseAuth called but Auth instance is null.",
        );
        throw new Error("Firebase Auth is not initialized.");
    }
    return firebaseAuthInstance;
}

// --- Setup Auth State Listener ---
function setupAuthListener(): void {
    if (isAuthListenerAttached) {
        console.warn("SW: Auth listener already attached. Skipping setup.");
        return;
    }
    try {
        const auth = getFirebaseAuth(); // Get the initialized Auth instance
        console.log("SW: Setting up onAuthStateChanged listener.");
        isAuthListenerAttached = true;

        onAuthStateChanged(
            auth,
            (user) => {
                console.log(
                    `SW: onAuthStateChanged triggered. User: ${user?.uid ?? "null"}`,
                );
                const changed = currentUser?.uid !== user?.uid;
                currentUser = user;

                // Resolve the promise *only the first time* it fires after init
                if (authReadyResolver) {
                    console.log("SW: Resolving authReadyPromise.");
                    authReadyResolver(currentUser);
                    authReadyResolver = null; // Prevent resolving again
                }

                // Optionally broadcast if state actually changed
                if (changed) {
                    console.log("SW: Broadcasting AUTH_STATE_UPDATED");
                    const statePayload = {
                        isLoggedIn: !!user,
                        uid: user?.uid ?? null,
                        email: user?.email ?? null,
                    };
                    chrome.runtime
                        .sendMessage({
                            type: "AUTH_STATE_UPDATED",
                            payload: statePayload,
                        })
                        .catch((e) =>
                            console.log(
                                "SW: Error broadcasting auth state (no listeners?):",
                                e.message,
                            ),
                        );
                }
            },
            (error) => {
                console.error("SW: Auth state listener error:", error);
                currentUser = null;
                if (authReadyResolver) {
                    // Resolve promise with null on error during initial check
                    console.log(
                        "SW: Resolving authReadyPromise with null due to listener error.",
                    );
                    authReadyResolver(null);
                    authReadyResolver = null;
                }
                // Optionally broadcast error state
                chrome.runtime
                    .sendMessage({
                        type: "AUTH_STATE_UPDATED",
                        payload: {
                            isLoggedIn: false,
                            uid: null,
                            email: null,
                            error: error.message,
                        },
                    })
                    .catch((e) =>
                        console.log(
                            "SW: Error broadcasting auth state error (no listeners?):",
                            e.message,
                        ),
                    );
            },
        );
        console.log("SW: Firebase Auth listener attached.");
    } catch (error) {
        console.error(
            "SW: Failed to get Auth instance or setup listener:",
            error,
        );
        isAuthListenerAttached = false; // Allow potential retry on next init attempt?
        if (authReadyResolver) {
            // Resolve with null if setup fails
            console.log(
                "SW: Resolving authReadyPromise with null due to listener setup error.",
            );
            authReadyResolver(null);
            authReadyResolver = null;
        }
        currentUser = null;
    }
}

// --- Initial Firebase Initialization Attempt ---
try {
    ensureFirebaseInitialized();
} catch (e) {
    console.error("SW: Initial Firebase initialization failed:", e);
}
// ============================================================================

// ============================================================================
// API CLIENT SETUP
// ============================================================================
(async () => {
    try {
        ensureFirebaseInitialized(); // Ensure Firebase is ready
        await ChatGptApiClient.initialize(); // Initialize API client (loads headers)
        console.log("SW: ChatGptApiClient initialized.");
    } catch (error) {
        console.error("SW: Failed to initialize ChatGptApiClient:", error);
    }
})();
// ============================================================================

// ============================================================================
// HEADER STORAGE
// ============================================================================
async function storeHeaders(headersToStore: any): Promise<void> {
    if (!headersToStore || Object.keys(headersToStore).length === 0) {
        return;
    }
    try {
        const currentData = await chrome.storage.local.get("apiHeaders");
        const filteredHeaders = Object.entries(headersToStore)
            .filter(([_, value]) => value !== null && value !== undefined)
            .reduce(
                (obj, [key, value]) => {
                    obj[key] = value as string; // Assume value is string after filtering
                    return obj;
                },
                {} as Record<string, string>,
            );

        if (Object.keys(filteredHeaders).length === 0) return;

        const mergedHeaders = {
            ...(currentData.apiHeaders || {}),
            ...filteredHeaders,
        };
        await chrome.storage.local.set({ apiHeaders: mergedHeaders });
        // console.log("SW (storeHeaders): Headers updated in storage"); // Less verbose logging

        ChatGptApiClient.getInstance().setHeaders(mergedHeaders);
    } catch (error) {
        console.error(
            "SW (storeHeaders): Error storing/updating headers",
            error,
        );
    }
}
// ============================================================================

// ============================================================================
// STRIPE CHECKOUT FUNCTION
// ============================================================================
interface CheckoutSessionPayload {
    planId: "monthly" | "lifetime";
}

interface CheckoutSessionResult {
    checkoutUrl: string;
}

async function createCheckoutSession(
    payload: CheckoutSessionPayload,
): Promise<CheckoutSessionResult> {
    const auth = getFirebaseAuth(); // Use getter for initialized Auth
    const userId = currentUser?.uid; // Use cached user

    if (!userId) {
        console.error(
            "SW (createCheckoutSession): User not logged in.",
        );
        throw new Error("User must be logged in to start checkout.");
    }

    let priceId: string | undefined;
    switch (payload.planId) {
        case "monthly":
            priceId = STRIPE_PRICE_ID_MONTHLY;
            break;
        case "lifetime":
            priceId = STRIPE_PRICE_ID_LIFETIME;
            break;
        default:
            // This case should ideally not be hit due to payload validation in listener
            console.error(
                `SW (createCheckoutSession): Invalid planId: ${payload.planId}`,
            );
            throw new Error(`Invalid plan selected.`);
    }

    if (!priceId) {
        console.error(
            `SW (createCheckoutSession): Stripe Price ID missing for plan: ${payload.planId}. Check constants.`,
        );
        throw new Error(
            `Configuration error: Price ID for the selected plan is missing.`,
        );
    }

    console.log(
        `SW: Creating checkout session document for user ${userId}, price ${priceId}`,
    );
    const db = getDb(); // Use getter for initialized Firestore
    const checkoutSessionCollection = collection(
        db,
        "customers",
        userId,
        "checkout_sessions",
    );

    try {
        const docRef: DocumentReference<DocumentData> = await addDoc(
            checkoutSessionCollection,
            {
                price: priceId,
                success_url: CHECKOUT_SUCCESS_URL,
                cancel_url: CHECKOUT_CANCEL_URL,
                mode: payload.planId === "lifetime" ? "payment" : "subscription",
                // Optional: Add metadata like client type or redirect behavior
                // client: 'extension',
                // metadata: { source: 'chrome-extension-auth-page' }
            },
        );

        console.log("SW: Checkout session document created:", docRef.id);

        return new Promise<CheckoutSessionResult>((resolve, reject) => {
            let timedOut = false;
            let unsubscribeCalled = false;
            let timeoutHandle: NodeJS.Timeout | null = null;
            let unsubscribeFirestore: Unsubscribe | null = null; // Store the unsubscribe function

            const cleanup = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                if (unsubscribeFirestore && !unsubscribeCalled) {
                    unsubscribeCalled = true;
                    console.log("SW: Unsubscribing Firestore listener for", docRef.id);
                    unsubscribeFirestore();
                }
            };

            unsubscribeFirestore = onSnapshot(
                docRef,
                (snap) => {
                    if (timedOut || unsubscribeCalled) return;
                    const data = snap.data();
                    console.log(
                        "SW: Snapshot update for checkout session:",
                        docRef.id,
                        data,
                    );

                    if (data?.error) {
                        console.error(
                            "SW: Stripe extension reported error:",
                            data.error,
                        );
                        cleanup();
                        reject(
                            new Error(
                                `Checkout failed: ${data.error.message || "Unknown Stripe error"}`,
                            ),
                        );
                    } else if (data?.url) {
                        console.log(
                            "SW: Stripe Checkout URL retrieved:",
                            data.url,
                        );
                        cleanup();
                        resolve({ checkoutUrl: data.url });
                    }
                },
                (error: FirestoreError) => {
                    if (timedOut || unsubscribeCalled) return;
                    console.error(
                        "SW: Firestore snapshot listener error:",
                        docRef.id,
                        error,
                    );
                    cleanup();
                    reject(
                        new Error(
                            `Failed to listen for checkout session updates: ${error.message}`,
                        ),
                    );
                },
            );

            timeoutHandle = setTimeout(() => {
                if (timedOut || unsubscribeCalled) return;
                timedOut = true;
                console.warn(
                    `SW: Timeout (${CHECKOUT_LISTENER_TIMEOUT}ms) waiting for checkout URL for doc ${docRef.id}`,
                );
                cleanup();
                reject(
                    new Error(
                        "Timeout waiting for Stripe Checkout URL. Please try again.",
                    ),
                );
            }, CHECKOUT_LISTENER_TIMEOUT);
        });
    } catch (error) {
        console.error(
            "SW: Firestore error adding checkout session doc:",
            error,
        );
        throw new Error(
            `Failed to initiate checkout: ${(error as Error).message}`,
        );
    }
}
// ============================================================================

// ============================================================================
// MESSAGE LISTENER
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const messageType = message?.type ?? "[Unknown Type]";
    console.log(
        `SW received: ${messageType} from ${sender.tab ? `Tab ${sender.tab.id}` : sender.id || "Unknown"}`,
        message.payload ? `with payload` : "" /* Avoid logging full payload */,
    );

    // --- Firebase Readiness Check ---
    let isFirebaseReady = true;
    const firebaseRequiredTypes = [
        "REGISTER_USER", "LOGIN_USER", "LOGOUT_USER", "GET_AUTH_STATE",
        "CREATE_CHECKOUT_SESSION", // <-- Added
        "FETCH_CONVERSATIONS", "FETCH_CONVERSATION", "DELETE_CONVERSATION", // <-- Added API Calls
        "SHARE_CONVERSATION", "ARCHIVE_CONVERSATION", "RENAME_CONVERSATION",
        "GENERATE_AUTOCOMPLETIONS", "SEND_COPY_FEEDBACK", "GET_AUDIO",
        "MARK_MESSAGE_THUMBS_UP", "MARK_MESSAGE_THUMBS_DOWN",
        "FETCH_CONVERSATION_MESSAGE_IDS", "FETCH_CONVERSATION_MESSAGES",
        "FETCH_CONVERSATION_CONTEXT", "FETCH_CONVERSATION_AUTHOR_COUNTS",
        "EXPORT_CONVERSATION_MARKDOWN", "COUNT_CONVERSATION_TOKENS"
    ];
    if (firebaseRequiredTypes.includes(messageType)) {
        try {
            ensureFirebaseInitialized();
            if (!firebaseApp || !firestoreInstance || !firebaseAuthInstance) {
                throw new Error(
                    "Firebase App, Firestore, or Auth instance is not available.",
                );
            }
        } catch (initError) {
            console.error(
                `SW: Firebase init check failed for ${messageType}:`,
                initError,
            );
            isFirebaseReady = false;
            sendResponse({
                success: false,
                error: {
                    name: "FirebaseError",
                    message: `Firebase not ready: ${(initError as Error).message}`,
                },
            });
            return true; // Indicate async response for error
        }
    }
    if (!isFirebaseReady) return true; // Stop processing if Firebase not ready

    // --- Async Handler ---
    const handleAsync = async (asyncFn: () => Promise<any>) => {
        try {
            // Only refresh API client headers for direct ChatGPT API calls
            if (messageType.startsWith("FETCH_") || messageType.startsWith("GET_AUDIO") || messageType.startsWith("MARK_") || messageType.startsWith("SHARE_") || messageType.startsWith("ARCHIVE_") || messageType.startsWith("RENAME_") || messageType.startsWith("GENERATE_") || messageType.startsWith("SEND_")) {
                console.log(`SW: Refreshing API headers for ${messageType}`);
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
                    message:
                        error.message || "An unknown error occurred in the service worker.",
                    stack: error.stack, // Good for debugging
                },
            });
        }
    };

    // --- Message Handling Logic ---
    switch (messageType) {
        // --- Interceptor ---
        case "HEADERS_RECEIVED":
            handleAsync(() => storeHeaders(message.data));
            break;
        case "AUTH_RECEIVED":
            handleAsync(async () => {
                await storeHeaders({
                    Authorization: `Bearer ${message.data.accessToken}`,
                });
                await chrome.storage.local.set({ authData: message.data });
            });
            break;
        case "ACCOUNT_RECEIVED": // Fallthrough
        case "CONVERSATION_LIMIT_RECEIVED": // Fallthrough
        case "MODELS_RECEIVED":
            handleAsync(() =>
                chrome.storage.local.set({ [messageType]: message.data }),
            );
            break;

        // --- Authentication ---
        case "REGISTER_USER":
            handleAsync(async () => {
                const { email, password } = message.payload;
                if (!email || !password)
                    throw new Error("Email and password required.");
                const userCredential = await createUserWithEmailAndPassword(
                    getFirebaseAuth(), // Use getter
                    email,
                    password,
                );
                return {
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                };
            });
            break;
        case "LOGIN_USER":
            handleAsync(async () => {
                const { email, password } = message.payload;
                if (!email || !password)
                    throw new Error("Email and password required.");
                const userCredential = await signInWithEmailAndPassword(
                    getFirebaseAuth(), // Use getter
                    email,
                    password,
                );
                return {
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                };
            });
            break;
        case "LOGOUT_USER":
            handleAsync(async () => {
                await signOut(getFirebaseAuth()); // Use getter
                return { message: "Logout successful." };
            });
            break;
        case "GET_AUTH_STATE":
            handleAsync(async () => {
                console.log("SW: GET_AUTH_STATE waiting for authReadyPromise...");
                // Wait for the initial onAuthStateChanged fire after SW start/restart
                const user = await authReadyPromise;
                console.log("SW: GET_AUTH_STATE returning user:", user?.uid);
                return user ? { uid: user.uid, email: user.email } : null;
            });
            break; // handleAsync makes this async

        // --- Stripe ---
        case "CREATE_CHECKOUT_SESSION":
            if (!message.payload?.planId || !['monthly', 'lifetime'].includes(message.payload.planId)) {
                // Send specific error back
                sendResponse({ success: false, error: { message: "Invalid or missing planId in payload" } });
                return false; // Sync response for validation failure
            }
            handleAsync(() => createCheckoutSession(message.payload));
            break;

        // --- ChatGPT API Wrappers ---
        case "FETCH_CONVERSATIONS": handleAsync(() => fetchConversations(message.payload?.offset, message.payload?.limit, message.payload?.order)); break;
        case "FETCH_CONVERSATION": handleAsync(() => fetchConversation(message.payload.conversationId)); break;
        case "DELETE_CONVERSATION": handleAsync(() => deleteConversation(message.payload.conversationId)); break;
        case "SHARE_CONVERSATION": handleAsync(() => shareConversation(message.payload.conversationId, message.payload.currentNodeId)); break;
        case "ARCHIVE_CONVERSATION": handleAsync(() => archiveConversation(message.payload.conversationId)); break;
        case "RENAME_CONVERSATION": handleAsync(() => renameConversation(message.payload.conversationId, message.payload.newTitle)); break;
        case "GENERATE_AUTOCOMPLETIONS": handleAsync(() => generateAutocompletions(message.payload.inputText, message.payload.numCompletions, message.payload.inSearchMode)); break;
        case "SEND_COPY_FEEDBACK": handleAsync(() => sendCopyFeedback(message.payload.messageId, message.payload.conversationId, message.payload.selectedText)); break;
        case "GET_AUDIO": handleAsync(async () => { const blob = await getAudioForMessage(message.payload.messageId, message.payload.conversationId, message.payload.voice, message.payload.format); const reader = new FileReader(); const dataUrl = await new Promise<string>((resolve, reject) => { reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob); }); return { dataUrl, format: message.payload.format || "aac", messageId: message.payload.messageId }; }); break;
        case "MARK_MESSAGE_THUMBS_UP": handleAsync(() => markMessageAsThumbsUp(message.payload.messageId, message.payload.conversationId)); break;
        case "MARK_MESSAGE_THUMBS_DOWN": handleAsync(() => markMessageAsThumbsDown(message.payload.messageId, message.payload.conversationId)); break;

        // --- Conversation Processing ---
        case "FETCH_CONVERSATION_MESSAGE_IDS": handleAsync(() => fetchConversationMessageIds(message.payload.conversationId)); break;
        case "FETCH_CONVERSATION_MESSAGES": handleAsync(() => fetchConversationMessages(message.payload.conversationId)); break;
        case "FETCH_CONVERSATION_CONTEXT": handleAsync(() => fetchConversationContext(message.payload.conversationId)); break;
        case "FETCH_CONVERSATION_AUTHOR_COUNTS": handleAsync(() => fetchConversationAuthorCounts(message.payload.conversationId)); break;
        case "EXPORT_CONVERSATION_MARKDOWN": handleAsync(() => exportConversationAsMarkdown(message.payload.conversationId)); break;
        case "COUNT_CONVERSATION_TOKENS": handleAsync(() => countConversationTokens(message.payload.conversationId, message.payload.model)); break;

        // --- Other Utilities ---
        case "GET_COOKIE":
            if (!message.payload?.name || !message.payload?.url) {
                sendResponse({ success: false, error: { message: "Missing cookie name or url" } });
                return false; // Sync response for validation failure
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
            return true; // Async due to callback

        default:
            console.warn(`SW: Unknown message type: ${messageType}`);
            sendResponse({
                success: false,
                error: { message: `Unknown message type '${messageType}'.` },
            });
            return false; // Sync response for unknown
    }

    // Indicate that we *might* send a response asynchronously
    // This is crucial for all cases handled by handleAsync or other callbacks
    return true;
});
// ============================================================================

// ============================================================================
// LIFECYCLE LISTENERS
// ============================================================================
chrome.runtime.onInstalled.addListener((details) => {
    console.log(
        `SW: Extension ${details.reason}. v${VERSION}. Prev: ${details.previousVersion || "N/A"}`,
    );
    // Reset auth ready promise on update/install
    initializeAuthReadyPromise();
    // Could also clear specific storage here if needed
});

chrome.runtime.onStartup.addListener(async () => {
    console.log("SW: Browser startup. Initializing...");
    // Reset auth ready promise on browser startup
    initializeAuthReadyPromise();
    try {
        ensureFirebaseInitialized(); // Ensure Firebase is ready
        await ChatGptApiClient.initialize(); // Refresh API client headers
        console.log("SW: Refreshed configurations on startup.");
    } catch (error) {
        console.error("SW: Error during onStartup:", error);
    }
});
// ============================================================================

console.log("SW: Event listeners attached.");
