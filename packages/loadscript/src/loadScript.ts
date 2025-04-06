// packages/loadscript/src/loadScript.ts

// --- Corrected & Added Type Definitions ---
type AuthEventResponse = CustomEvent<{ accessToken: string }>;
type AccountEventResponse = CustomEvent<{ accounts: any[] }>; // Added
type ConversationLimitEventResponse = CustomEvent<{ message_cap: any }>; // Added
type ModelsEventResponse = CustomEvent<{ models: any[] }>; // Added
type HeadersEventResponse = CustomEvent<{
    "OAI-Language"?: string;
    "OAI-Device-Id"?: string;
    Authorization?: string;
}>;
// --- End Type Definitions ---

console.log("LoadScript script executing...");

// --- Retry Configuration ---
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;
// --- END Retry Configuration ---

// --- Delay Helper ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// --- END Delay Helper ---


/**
 * Safely sends a message to the service worker with retry logic for connection errors.
 * This version is fire-and-forget, it doesn't wait for or process the SW response.
 * @param message The message object { type: string; data: any } to send.
 */
async function safeSendMessage(message: { type: string; data: any }): Promise<void> {
    console.log(
        `LoadScript: Attempting to send message -> Type: ${message.type}`,
    );

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            await new Promise<void>((resolve, reject) => {
                // Use '_' to indicate the response parameter is intentionally unused
                chrome.runtime.sendMessage(message, (_) => {
                    if (chrome.runtime.lastError) {
                        console.warn(
                            `LoadScript: chrome.runtime.lastError on attempt ${attempt + 1}/${MAX_RETRIES + 1} sending ${message.type}:`,
                            chrome.runtime.lastError.message,
                        );
                        if (chrome.runtime.lastError.message?.includes("Receiving end does not exist")) {
                            return reject(new Error(chrome.runtime.lastError.message));
                        }
                        console.error("LoadScript: Unhandled runtime.lastError:", chrome.runtime.lastError.message);
                        resolve(); // Resolve for other lastErrors in fire-and-forget

                    } else {
                        // Optional: Log successful send
                        // console.log(`LoadScript: Message ${message.type} sent successfully (Attempt ${attempt + 1}).`);
                        resolve();
                    }
                });
            });

            console.log(`LoadScript: Message ${message.type} sent successfully (or non-connection error occurred) on attempt ${attempt + 1}.`);
            return; // Exit loop on success or non-retried error

        } catch (error: any) {
            console.warn(
                `LoadScript: Error during sendMessage attempt ${attempt + 1}/${MAX_RETRIES + 1} for ${message.type}:`,
                error.message,
            );

            if (error.message?.includes("Receiving end does not exist") && attempt < MAX_RETRIES) {
                console.warn(`LoadScript: Connection error on attempt ${attempt + 1}. Retrying after ${RETRY_DELAY_MS}ms...`);
                await delay(RETRY_DELAY_MS);
                // Continue to next loop iteration
            } else {
                console.error(
                    `LoadScript: Failed to send ${message.type} message after ${attempt + 1} attempts. Final error:`,
                    error,
                );
                return; // Exit loop after final failure
            }
        }
    }
    console.error(`LoadScript: Exhausted all ${MAX_RETRIES + 1} attempts to send message ${message.type}.`);
}


// Helper function to inject the interceptor script
function injectScript(scriptUrl: string): void {
    if (document.querySelector(`script[src="${scriptUrl}"]`)) {
        console.log("LoadScript: Interceptor script already injected.");
        return;
    }
    try {
        const newScriptElement: HTMLScriptElement = document.createElement("script");
        newScriptElement.setAttribute("src", scriptUrl);
        newScriptElement.setAttribute("type", "text/javascript");
        newScriptElement.onload = function(this: GlobalEventHandlers, _ev: Event): void {
            console.log("LoadScript: Interceptor script loaded successfully.");
            (this as HTMLScriptElement)?.remove();
        };
        newScriptElement.onerror = (ev: Event | string) => {
            console.error("LoadScript: Failed to load interceptor script:", ev);
        };
        document.documentElement.prepend(newScriptElement);
        console.log("LoadScript: Injecting interceptor script:", scriptUrl);
    } catch (e) {
        console.error("LoadScript: Error creating or injecting script element:", e);
    }
}

// Main initialization function
function initialize(): void {
    try {
        const interceptorScriptUrl: string = chrome.runtime.getURL("interceptor.js");
        injectScript(interceptorScriptUrl);

        // Add listeners with the updated safeSendMessage wrapper and correct types
        window.addEventListener("headersReceived", ((event: HeadersEventResponse) => {
            if (event.detail) {
                console.log("LoadScript: Event 'headersReceived' caught.");
                safeSendMessage({ type: "HEADERS_RECEIVED", data: event.detail });
            }
        }) as EventListener);

        window.addEventListener("authReceived", ((event: AuthEventResponse) => {
            if (event.detail?.accessToken) {
                console.log("LoadScript: Event 'authReceived' caught.");
                safeSendMessage({ type: "AUTH_RECEIVED", data: event.detail });
            }
        }) as EventListener);

        // --- Use Corrected Types ---
        window.addEventListener("accountReceived", ((event: AccountEventResponse) => {
            if (event.detail?.accounts) {
                console.log("LoadScript: Event 'accountReceived' caught.");
                safeSendMessage({ type: "ACCOUNT_RECEIVED", data: event.detail });
            }
        }) as EventListener);

        window.addEventListener("conversationLimitReceived", ((event: ConversationLimitEventResponse) => {
            if (event.detail?.message_cap) {
                console.log("LoadScript: Event 'conversationLimitReceived' caught.");
                safeSendMessage({ type: "CONVERSATION_LIMIT_RECEIVED", data: event.detail });
            }
        }) as EventListener);

        window.addEventListener("modelsReceived", ((event: ModelsEventResponse) => {
            if (event.detail?.models) {
                console.log("LoadScript: Event 'modelsReceived' caught.");
                safeSendMessage({ type: "MODELS_RECEIVED", data: event.detail });
            }
        }) as EventListener);
        // --- End Corrected Types ---

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
