// packages/loadscript/src/loadScript.ts
console.log("LoadScript script placeholder");

type AuthEventResponse = CustomEvent<{ accessToken: string }>;
type AccountEventResponse = CustomEvent<{ accounts: any[] }>;
type ConversationLimitEventResponse = CustomEvent<{ message_cap: any }>;
type ModelsEventResponse = CustomEvent<{ models: any[] }>;
type HeadersEventResponse = CustomEvent<{
    "OAI-Language"?: string;
    "OAI-Device-Id"?: string;
    Authorization?: string;
}>;

// Helper to safely send message
function safeSendMessage(message: { type: string; data: any }) {
    // Check if the runtime context is still valid before sending
    if (chrome.runtime?.id) {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    // Log errors specifically related to the message sending itself
                    console.warn(
                        `LoadScript: Error sending ${message.type} message:`,
                        chrome.runtime.lastError.message,
                    );
                } else {
                    // Optional: log success or handle response if needed
                    // console.log(`LoadScript: Message ${message.type} sent, response:`, response);
                }
            });
        } catch (error) {
            // Catch synchronous errors during the sendMessage call (less common)
            console.warn(
                `LoadScript: Failed to send ${message.type} message:`,
                error,
            );
        }
    } else {
        // Log if the extension context seems invalidated *before* trying to send
        console.warn(
            `LoadScript: Extension context invalidated, cannot send ${message.type} message.`,
        );
    }
}

// Helper function to inject the interceptor script
function injectScript(scriptUrl: string): void {
    // Check if script already injected (optional safeguard)
    if (document.querySelector(`script[src="${scriptUrl}"]`)) {
        return;
    }
    const newScriptElement: HTMLScriptElement =
        document.createElement("script");
    newScriptElement.setAttribute("src", scriptUrl);
    newScriptElement.setAttribute("type", "text/javascript"); // Keep as text/javascript for wide compatibility
    newScriptElement.onload = function (
        this: GlobalEventHandlers,
        _ev: Event,
    ): void {
        // Use optional chaining for removal in case it's already gone
        (this as HTMLScriptElement)?.remove();
    };
    // Prepending might be slightly safer than appending in some scenarios
    document.documentElement.prepend(newScriptElement);
}

// Main initialization function
function initialize(): void {
    const interceptorScriptUrl: string =
        chrome.runtime.getURL("interceptor.js");
    injectScript(interceptorScriptUrl);

    // Add listeners with safeSendMessage wrapper
    window.addEventListener("headersReceived", ((
        event: HeadersEventResponse,
    ) => {
        if (event.detail) {
            console.log("Headers received in LoadScript: ", event.detail);
            safeSendMessage({ type: "HEADERS_RECEIVED", data: event.detail });
        }
    }) as EventListener);

    window.addEventListener("authReceived", ((event: AuthEventResponse) => {
        if (event.detail?.accessToken) {
            console.log("Auth received in LoadScript: ", event.detail);
            safeSendMessage({ type: "AUTH_RECEIVED", data: event.detail });
        }
    }) as EventListener);

    window.addEventListener("accountReceived", ((
        event: AccountEventResponse,
    ) => {
        if (event.detail?.accounts) {
            console.log("Account received in LoadScript: ", event.detail);
            safeSendMessage({ type: "ACCOUNT_RECEIVED", data: event.detail });
        }
    }) as EventListener);

    window.addEventListener("conversationLimitReceived", ((
        event: ConversationLimitEventResponse,
    ) => {
        if (event.detail?.message_cap) {
            console.log(
                "Conversation limit received in LoadScript: ",
                event.detail,
            );
            safeSendMessage({
                type: "CONVERSATION_LIMIT_RECEIVED",
                data: event.detail,
            });
        }
    }) as EventListener);

    window.addEventListener("modelsReceived", ((event: ModelsEventResponse) => {
        if (event.detail?.models) {
            console.log("Models received in LoadScript: ", event.detail); // Corrected log message
            safeSendMessage({ type: "MODELS_RECEIVED", data: event.detail });
        }
    }) as EventListener);
}

// Initialize when the document is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}
