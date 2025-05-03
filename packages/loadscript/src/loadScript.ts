// packages/loadscript/src/loadScript.ts
import { MSG } from "@shared"; // Import the message constants

// --- Type Definitions for Events from Interceptor ---
type AuthEventResponse = CustomEvent<{ accessToken: string }>;
type AccountEventResponse = CustomEvent<{ accounts: any[] }>;
type ConversationLimitEventResponse = CustomEvent<{ message_cap: any }>;
type ModelsEventResponse = CustomEvent<{ models: any[] }>;
type HeadersEventResponse = CustomEvent<{
    "OAI-Language"?: string;
    "OAI-Device-Id"?: string;
    Authorization?: string;
}>;

// Define the event type strings used by interceptor.ts for mapping
// (These MUST match the keys in interceptor.ts -> EVENT_TYPES)
const INTERCEPTOR_EVENT = {
    HEADERS_RECEIVED: "headersReceived",
    AUTH_RECEIVED: "authReceived",
    ACCOUNT_RECEIVED: "accountReceived",
    CONVERSATION_LIMIT_RECEIVED: "conversationLimitReceived",
    MODELS_RECEIVED: "modelsReceived",
} as const;

console.log("LoadScript script executing...");

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely sends a message to the service worker with retry logic for connection errors.
 * This version is fire-and-forget, it doesn't wait for or process the SW response.
 * @param message The message object { type: string (from MSG constants); data: any } to send.
 */
async function safeSendMessage(message: {
    type: (typeof MSG)[keyof typeof MSG]; // Enforce type from MSG values
    data: any;
}): Promise<void> {
    console.log(
        `LoadScript: Attempting to send message -> Type: ${message.type}`,
    );

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            await new Promise<void>((resolve, reject) => {
                chrome.runtime.sendMessage(message, (_) => {
                    // Pass the correctly typed message
                    if (chrome.runtime.lastError) {
                        console.warn(
                            `LoadScript: chrome.runtime.lastError on attempt ${attempt + 1}/${MAX_RETRIES + 1} sending ${message.type}:`,
                            chrome.runtime.lastError.message,
                        );
                        if (
                            chrome.runtime.lastError.message?.includes(
                                "Receiving end does not exist",
                            )
                        ) {
                            return reject(
                                new Error(chrome.runtime.lastError.message),
                            );
                        }
                        console.error(
                            "LoadScript: Unhandled runtime.lastError:",
                            chrome.runtime.lastError.message,
                        );
                        resolve();
                    } else {
                        resolve();
                    }
                });
            });

            console.log(
                `LoadScript: Message ${message.type} sent successfully (or non-connection error occurred) on attempt ${attempt + 1}.`,
            );
            return; // Exit loop on success or non-retried error
        } catch (error: any) {
            console.warn(
                `LoadScript: Error during sendMessage attempt ${attempt + 1}/${MAX_RETRIES + 1} for ${message.type}:`,
                error.message,
            );

            if (
                error.message?.includes("Receiving end does not exist") &&
                attempt < MAX_RETRIES
            ) {
                console.warn(
                    `LoadScript: Connection error on attempt ${attempt + 1}. Retrying after ${RETRY_DELAY_MS}ms...`,
                );
                await delay(RETRY_DELAY_MS);
            } else {
                console.error(
                    `LoadScript: Failed to send ${message.type} message after ${attempt + 1} attempts. Final error:`,
                    error,
                );
                return;
            }
        }
    }
    console.error(
        `LoadScript: Exhausted all ${MAX_RETRIES + 1} attempts to send message ${message.type}.`,
    );
}

// Helper function to inject the interceptor script (remains the same)
function injectScript(scriptUrl: string): void {
    if (document.querySelector(`script[src="${scriptUrl}"]`)) {
        console.log("LoadScript: Interceptor script already injected.");
        return;
    }
    try {
        const newScriptElement: HTMLScriptElement =
            document.createElement("script");
        newScriptElement.setAttribute("src", scriptUrl);
        newScriptElement.setAttribute("type", "text/javascript");
        newScriptElement.onload = function (
            this: GlobalEventHandlers,
            _ev: Event,
        ): void {
            console.log("LoadScript: Interceptor script loaded successfully.");
            (this as HTMLScriptElement)?.remove();
        };
        newScriptElement.onerror = (ev: Event | string) => {
            console.error("LoadScript: Failed to load interceptor script:", ev);
        };
        document.documentElement.prepend(newScriptElement);
        console.log("LoadScript: Injecting interceptor script:", scriptUrl);
    } catch (e) {
        console.error(
            "LoadScript: Error creating or injecting script element:",
            e,
        );
    }
}

// Main initialization function
function initialize(): void {
    try {
        const interceptorScriptUrl: string =
            chrome.runtime.getURL("interceptor.js");
        injectScript(interceptorScriptUrl);

        // --- Event Listeners using MSG constants for forwarding ---

        window.addEventListener(INTERCEPTOR_EVENT.HEADERS_RECEIVED, ((
            event: HeadersEventResponse,
        ) => {
            if (event.detail) {
                console.log("LoadScript: Event 'headersReceived' caught.");
                // Map the event type string to the MSG constant
                safeSendMessage({
                    type: MSG.HEADERS_RECEIVED, // <-- Use constant
                    data: event.detail,
                });
            }
        }) as EventListener);

        window.addEventListener(INTERCEPTOR_EVENT.AUTH_RECEIVED, ((
            event: AuthEventResponse,
        ) => {
            if (event.detail?.accessToken) {
                console.log("LoadScript: Event 'authReceived' caught.");
                // Map the event type string to the MSG constant
                safeSendMessage({
                    type: MSG.AUTH_RECEIVED,
                    data: event.detail,
                }); // <-- Use constant
            }
        }) as EventListener);

        window.addEventListener(INTERCEPTOR_EVENT.ACCOUNT_RECEIVED, ((
            event: AccountEventResponse,
        ) => {
            if (event.detail?.accounts) {
                console.log("LoadScript: Event 'accountReceived' caught.");
                // Map the event type string to the MSG constant
                safeSendMessage({
                    type: MSG.ACCOUNT_RECEIVED, // <-- Use constant
                    data: event.detail,
                });
            }
        }) as EventListener);

        window.addEventListener(
            INTERCEPTOR_EVENT.CONVERSATION_LIMIT_RECEIVED,
            ((event: ConversationLimitEventResponse) => {
                if (event.detail?.message_cap) {
                    console.log(
                        "LoadScript: Event 'conversationLimitReceived' caught.",
                    );
                    // Map the event type string to the MSG constant
                    safeSendMessage({
                        type: MSG.CONVERSATION_LIMIT_RECEIVED, // <-- Use constant
                        data: event.detail,
                    });
                }
            }) as EventListener,
        );

        window.addEventListener(INTERCEPTOR_EVENT.MODELS_RECEIVED, ((
            event: ModelsEventResponse,
        ) => {
            if (event.detail?.models) {
                console.log("LoadScript: Event 'modelsReceived' caught.");
                // Map the event type string to the MSG constant
                safeSendMessage({
                    type: MSG.MODELS_RECEIVED, // <-- Use constant
                    data: event.detail,
                });
            }
        }) as EventListener);

        console.log("LoadScript: Event listeners added.");
    } catch (initError) {
        console.error("LoadScript: Error during initialization:", initError);
    }
}

// Initialize when the document is ready
if (document.readyState === "loading") {
    console.log("LoadScript: DOM not ready, adding DOMContentLoaded listener.");
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    console.log("LoadScript: DOM ready, initializing immediately.");
    initialize();
}
