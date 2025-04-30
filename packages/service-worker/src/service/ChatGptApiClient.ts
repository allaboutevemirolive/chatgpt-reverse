// src/service/ChatGptApiClient.ts
interface RequestHeaders {
    [key: string]: string;
}

/**
 * Retrieves stored API headers from chrome.storage.local.
 * Used internally by the ApiClient.
 */
async function getStoredHeadersFromWorker(): Promise<RequestHeaders> {
    try {
        // Ensure we wait for the promise to resolve
        const data = await chrome.storage.local.get("apiHeaders");
        console.log(
            "ChatGptApiClient (getStoredHeaders): Retrieved headers from storage",
            data?.apiHeaders, // Use optional chaining for safety
        );
        // Return the headers or an empty object if not found
        return data?.apiHeaders || {};
    } catch (error) {
        console.error(
            "ChatGptApiClient (getStoredHeaders): Error retrieving headers from storage",
            error,
        );
        return {}; // Return empty object on error
    }
}

/**
 * Singleton class responsible for making authenticated requests to the ChatGPT backend API.
 * It manages API headers and provides methods for various API endpoints.
 */
export class ChatGptApiClient {
    private static instance: ChatGptApiClient;
    private headers: RequestHeaders = {};

    private readonly baseUrl: string = "https://chatgpt.com";

    /**
     * Private constructor to enforce singleton pattern.
     */
    private constructor() {
        console.log(
            "ChatGptApiClient instance created in Service Worker context.",
        );
    }

    /**
     * Gets the singleton instance of the ChatGptApiClient.
     * @returns The singleton ChatGptApiClient instance.
     */
    public static getInstance(): ChatGptApiClient {
        if (!ChatGptApiClient.instance) {
            ChatGptApiClient.instance = new ChatGptApiClient();
        }
        return ChatGptApiClient.instance;
    }

    /**
     * Updates the headers stored within the ApiClient instance.
     * Automatically adds 'Content-Type': 'application/json'.
     * @param newHeaders - The headers object to set or merge.
     */
    public setHeaders(newHeaders: RequestHeaders): void {
        // Preserve existing headers and overwrite/add new ones
        // Ensure Content-Type is always set for typical JSON requests
        this.headers = {
            ...this.headers, // Keep existing headers
            ...newHeaders, // Add/overwrite with new ones
            "Content-Type": "application/json", // Ensure this is set
        };
        console.log(
            "ChatGptApiClient (setHeaders): Headers updated in instance",
            this.headers,
        );
    }

    /**
     * Initializes the singleton instance by fetching stored headers.
     * Should be called once when the service worker starts or needs to ensure headers are loaded.
     */
    public static async initialize(): Promise<void> {
        const instance = ChatGptApiClient.getInstance();
        const storedHeaders = await getStoredHeadersFromWorker();
        // Use the instance's setHeaders method to update its internal state
        instance.setHeaders(storedHeaders);
        console.log(
            "ChatGptApiClient (initialize): Instance initialized with headers from storage.",
        );
    }

    /**
     * Retrieves the current headers stored in the instance.
     * Primarily for internal use by makeRequest.
     * @returns A copy of the current headers.
     */
    private getHeaders(): RequestHeaders {
        // Return a copy to prevent external modification
        return { ...this.headers };
    }

    /**
     * Fetches the latest headers from storage and updates the instance.
     * Useful for ensuring the instance has the most recent headers before a request.
     */
    public async refreshHeadersFromStorage(): Promise<void> {
        const storedHeaders = await getStoredHeadersFromWorker();
        // Only update if storedHeaders actually contains data
        if (storedHeaders && Object.keys(storedHeaders).length > 0) {
            this.setHeaders(storedHeaders);
            console.log(
                "ChatGptApiClient (refreshHeaders): Headers refreshed from storage.",
            );
        } else {
            console.warn(
                "ChatGptApiClient (refreshHeaders): No headers found in storage during refresh.",
            );
        }
    }

    /**
     * Core method for making API requests. Handles header injection, error handling, and response parsing.
     * @param endpoint - The API endpoint path (e.g., "/backend-api/conversations").
     * @param method - The HTTP method (e.g., "GET", "POST", "PATCH").
     * @param body - Optional request body data (will be JSON.stringify'd).
     * @param responseType - Expected response type ("json" or "blob"). Defaults to "json".
     * @returns A promise resolving with the parsed response data (JSON object or Blob).
     * @throws An error if required headers are missing or the API request fails.
     */
    private async makeRequest<T>(
        endpoint: string,
        method: string,
        body?: any,
        responseType: "json" | "blob" = "json",
    ): Promise<T> {
        // Attempt to refresh headers from storage right before making the request.
        // This adds robustness against timing issues where the instance might not
        // have the latest headers immediately after interception.
        await this.refreshHeadersFromStorage();

        const currentHeaders = this.getHeaders(); // Get potentially updated headers

        // Check for essential headers AFTER refreshing
        if (
            !currentHeaders["Authorization"] && // Check if BOTH are missing. Adjust if only one is needed initially.
            !currentHeaders["OAI-Device-Id"]
        ) {
            console.error(
                "ChatGptApiClient (makeRequest): Required headers (Authorization or OAI-Device-Id) are missing even after refresh.",
                currentHeaders,
            );
            // Consider adding a small delay and retry *once* if this becomes a persistent issue
            // Example:
            // console.log("ChatGptApiClient (makeRequest): Retrying header refresh after delay...");
            // await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
            // await this.refreshHeadersFromStorage();
            // const refreshedAgainHeaders = this.getHeaders();
            // if (!refreshedAgainHeaders["Authorization"] && !refreshedAgainHeaders["OAI-Device-Id"]) {
            //    throw new Error("Required headers (Authorization or OAI-Device-Id) are not available after retry.");
            // }
            // // If retry worked, continue with refreshedAgainHeaders...
            throw new Error(
                "Required headers (Authorization or OAI-Device-Id) are not available.",
            );
        }

        // Construct fetch options
        const fetchOptions: RequestInit = {
            method,
            headers: currentHeaders, // Use the potentially updated headers
            credentials: "include", // Important for session/auth cookies
            body: body ? JSON.stringify(body) : undefined,
        };

        console.log(
            `ChatGptApiClient (makeRequest): Making ${method} request to ${this.baseUrl}${endpoint}`,
            body ? "with body:" : "",
            body ?? "",
        );

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);
        } catch (networkError: any) {
            console.error(
                `ChatGptApiClient (makeRequest): Network error during fetch for ${method} ${endpoint}:`,
                networkError,
            );
            throw new Error(`Network error: ${networkError.message}`);
        }

        console.log(
            `ChatGptApiClient (makeRequest): Received response ${response.status} for ${method} ${endpoint}`,
        );

        // Handle non-OK responses
        if (!response.ok) {
            let errorBody = `[Failed to read error body: ${response.statusText}]`;
            try {
                // Attempt to read body for more details, but handle potential errors
                const textBody = await response.text();
                // Limit length to prevent huge logs
                errorBody =
                    textBody.length > 500
                        ? textBody.substring(0, 500) + "..."
                        : textBody;
            } catch (e) {
                console.warn(
                    "ChatGptApiClient (makeRequest): Could not read error response body.",
                    e,
                );
            }
            console.error(
                `ChatGptApiClient (makeRequest): API request failed: ${response.status} ${response.statusText}. Body: ${errorBody}`,
            );
            // Create a more informative error
            const error = new Error(
                `API request failed: ${response.status} ${response.statusText}. Details: ${errorBody}`,
            );
            (error as any).status = response.status; // Attach status code if needed
            throw error;
        }

        // Handle Blob response
        if (responseType === "blob") {
            try {
                const blob = await response.blob();
                return blob as T; // Cast Blob to T, assuming T is Blob or compatible
            } catch (blobError: any) {
                console.error(
                    "ChatGptApiClient (makeRequest): Error reading response as Blob.",
                    blobError,
                );
                throw new Error(
                    `Failed to read response as Blob: ${blobError.message}`,
                );
            }
        }

        // Handle potential empty JSON responses (e.g., 204 No Content)
        if (
            response.status === 204 ||
            response.headers.get("content-length") === "0"
        ) {
            console.log(
                `ChatGptApiClient (makeRequest): Received empty response body (Status: ${response.status})`,
            );
            // Return an empty object or null based on expected T structure
            return {} as T;
        }

        // Handle JSON response
        try {
            const jsonData = await response.json();
            // console.log("ChatGptApiClient (makeRequest): Parsed JSON response:", jsonData); // Optional: Log successful JSON data
            return jsonData as T; // Cast JSON object to T
        } catch (jsonError: any) {
            console.error(
                "ChatGptApiClient (makeRequest): Failed to parse JSON response.",
                jsonError,
            );
            throw new Error(
                `Failed to parse JSON response from API: ${jsonError.message}`,
            );
        }
    }

    // --- Public API Methods ---

    public async getConversations(
        offset: number = 0,
        limit: number = 28,
        order: string = "updated",
    ): Promise<any> {
        // TODO: Consider defining a specific ConversationListResponse type
        return this.makeRequest(
            `/backend-api/conversations?offset=${offset}&limit=${limit}&order=${order}`,
            "GET",
        );
    }

    public async deleteConversation(conversationId: string): Promise<any> {
        // Consider defining specific SuccessResponse type
        return this.makeRequest(
            `/backend-api/conversation/${conversationId}`,
            "PATCH",
            { is_visible: false }, // Payload to mark as not visible
        );
    }

    public async shareConversation(
        conversationId: string,
        currentNodeId: string,
    ): Promise<any> {
        // Consider defining ShareResponse type
        return this.makeRequest(`/backend-api/share/create`, "POST", {
            current_node_id: currentNodeId,
            conversation_id: conversationId,
            is_anonymous: true, // Or parameterize if needed
        });
    }

    public async getConversation(conversationId: string): Promise<any> {
        // Consider defining ConversationDetailResponse type
        return this.makeRequest(
            `/backend-api/conversation/${conversationId}`,
            "GET",
        );
    }

    public async archiveConversation(conversationId: string): Promise<any> {
        // Consider defining SuccessResponse type
        return this.makeRequest(
            `/backend-api/conversation/${conversationId}`,
            "PATCH",
            { is_archived: true },
        );
    }

    public async renameConversation(
        conversationId: string,
        newTitle: string,
    ): Promise<any> {
        // Consider defining SuccessResponse type
        return this.makeRequest(
            `/backend-api/conversation/${conversationId}`,
            "PATCH",
            { title: newTitle },
        );
    }

    public async generateAutocompletions(
        inputText: string,
        numCompletions: number = 4,
        inSearchMode: boolean = false,
    ): Promise<any> {
        // Consider defining AutocompletionsResponse type
        return this.makeRequest(
            `/backend-api/conversation/experimental/generate_autocompletions`,
            "POST",
            {
                input_text: inputText,
                num_completions: numCompletions,
                in_search_mode: inSearchMode,
            },
        );
    }

    public async sendCopyFeedback(
        messageId: string,
        conversationId: string,
        selectedText: string,
    ): Promise<any> {
        // Consider defining SuccessResponse type
        return this.makeRequest(
            `/backend-api/conversation/implicit_message_feedback`,
            "POST",
            {
                message_id: messageId,
                conversation_id: conversationId,
                source: "mouse", // Or parameterize if needed
                feedback: {
                    feedback_type: "copy",
                    selected_text: selectedText,
                },
                location: "message", // Or parameterize if needed
            },
        );
    }

    public async getAudio(
        messageId: string,
        conversationId: string,
        voice: string = "orbit",
        format: string = "aac",
    ): Promise<Blob> {
        // Construct URL ensuring proper encoding
        const params = new URLSearchParams({
            message_id: messageId,
            conversation_id: conversationId,
            voice: voice,
            format: format,
        });
        const url = `/backend-api/synthesize?${params.toString()}`;

        // Explicitly expect a Blob response
        return this.makeRequest<Blob>(url, "GET", undefined, "blob");
    }

    public async markMessageThumbsUp(
        messageId: string,
        conversationId: string,
    ): Promise<any> {
        // Consider defining FeedbackResponse type
        return this.makeRequest(
            `/backend-api/conversation/message_feedback`,
            "POST",
            {
                message_id: messageId,
                conversation_id: conversationId,
                rating: "thumbsUp",
            },
        );
    }

    public async markMessageThumbsDown(
        messageId: string,
        conversationId: string,
    ): Promise<any> {
        // Consider defining FeedbackResponse type
        return this.makeRequest(
            `/backend-api/conversation/message_feedback`,
            "POST",
            {
                message_id: messageId,
                conversation_id: conversationId,
                rating: "thumbsDown",
            },
        );
    }
}
