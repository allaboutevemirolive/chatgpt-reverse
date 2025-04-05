// packages/interceptor/src/interceptor.ts
console.log('Interceptor script placeholder');

export const API_ENDPOINTS = {
    AUTH: "api/auth/session",
    ACCOUNTS: "backend-api/accounts/check",
    CONVERSATION_LIMIT: "public-api/conversation_limit",
    MODELS: "backend-api/models",
    // BACKEND: 'backend-api'
} as const;

// NOTE: ChatGPT somehow refuse connection when we listen to generic network,
// etc, `backend-api`.
export const EVENT_TYPES = {
    AUTH_RECEIVED: "authReceived",
    ACCOUNT_RECEIVED: "accountReceived",
    CONVERSATION_LIMIT_RECEIVED: "conversationLimitReceived",
    MODELS_RECEIVED: "modelsReceived",
    HEADERS_RECEIVED: "headersReceived",
    // BACKEND_RECEIVED: 'backendReceived',
} as const;

// Headers interface
export interface RequestHeaders {
    "OAI-Language"?: string;
    "OAI-Device-Id"?: string;
    Authorization?: string;
}

export type AuthResponse = { accessToken: string;[key: string]: any };
export type AccountResponse = { accounts: any[];[key: string]: any };
export type ConversationLimitResponse = {
    message_cap: any;
    [key: string]: any;
};
export type ModelResponse = { models: any[];[key: string]: any };

// Store for headers
let storedHeaders: RequestHeaders = {};

// Function to extract headers from Request
function extractHeaders(request: Request): RequestHeaders {
    const headers: RequestHeaders = {};

    if (request.headers.has("OAI-Language")) {
        headers["OAI-Language"] =
            request.headers.get("OAI-Language") || undefined;
    }
    if (request.headers.has("OAI-Device-Id")) {
        headers["OAI-Device-Id"] =
            request.headers.get("OAI-Device-Id") || undefined;
    }
    if (request.headers.has("Authorization")) {
        headers["Authorization"] =
            request.headers.get("Authorization") || undefined;
    }

    return headers;
}

const originalFetch: typeof fetch = window.fetch;

window.fetch = async function(
    ...args: Parameters<typeof fetch>
): Promise<Response> {
    console.log("Running Interceptor: ", args);
    const input = args[0];
    let url: string;
    let request: Request;

    // Convert input to Request object and extract URL
    if (input instanceof Request) {
        request = input;
        url = input.url;
    } else {
        const init = args[1] || {};
        request = new Request(input, init);
        url = typeof input === "string" ? input : input.href;
    }

    // Extract and store headers
    const headers = extractHeaders(request);
    if (Object.keys(headers).length > 0) {
        storedHeaders = { ...storedHeaders, ...headers };
        window.dispatchEvent(
            new CustomEvent(EVENT_TYPES.HEADERS_RECEIVED, {
                detail: storedHeaders,
            }),
        );
    }

    const response: Response = await originalFetch(...args);

    if (response) {
        // if (url.includes(API_ENDPOINTS.BACKEND)) {
        //     const responseData = await response.clone().json() as AuthResponse;
        //     if (responseData.accessToken) {
        //         window.dispatchEvent(new CustomEvent(EVENT_TYPES.BACKEND_RECEIVED, { detail: responseData }));
        //     }
        // }

        if (url.includes(API_ENDPOINTS.AUTH)) {
            const responseData = (await response
                .clone()
                .json()) as AuthResponse;
            if (responseData.accessToken) {
                window.dispatchEvent(
                    new CustomEvent(EVENT_TYPES.AUTH_RECEIVED, {
                        detail: responseData,
                    }),
                );
            }
        }

        if (url.includes(API_ENDPOINTS.ACCOUNTS)) {
            const responseData = (await response
                .clone()
                .json()) as AccountResponse;
            if (responseData.accounts) {
                window.dispatchEvent(
                    new CustomEvent(EVENT_TYPES.ACCOUNT_RECEIVED, {
                        detail: responseData,
                    }),
                );
            }
        }

        if (url.includes(API_ENDPOINTS.CONVERSATION_LIMIT)) {
            const responseData = (await response
                .clone()
                .json()) as ConversationLimitResponse;
            if (responseData.message_cap) {
                window.dispatchEvent(
                    new CustomEvent(EVENT_TYPES.CONVERSATION_LIMIT_RECEIVED, {
                        detail: responseData,
                    }),
                );
            }
        }

        if (url.includes(API_ENDPOINTS.MODELS)) {
            const responseData = (await response
                .clone()
                .json()) as ModelResponse;
            if (responseData.models) {
                window.dispatchEvent(
                    new CustomEvent(EVENT_TYPES.MODELS_RECEIVED, {
                        detail: responseData,
                    }),
                );
            }
        }
    }

    return response;
};

// Export the stored headers getter
export function getStoredHeaders(): RequestHeaders {
    return { ...storedHeaders };
}
