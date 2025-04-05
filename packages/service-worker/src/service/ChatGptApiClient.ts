// src/service/ApiClient.ts
interface RequestHeaders {
    [key: string]: string;
}

async function getStoredHeadersFromWorker(): Promise<RequestHeaders> {
    try {
        const data = await chrome.storage.local.get("apiHeaders");
        console.log(
            "ChatGptApiClient: Retrieved headers from storage",
            data.apiHeaders,
        );
        return data.apiHeaders || {};
    } catch (error) {
        console.error(
            "ChatGptApiClient: Error retrieving headers from storage",
            error,
        );
        return {};
    }
}

export class ChatGptApiClient {
    private static instance: ChatGptApiClient;
    private headers: RequestHeaders = {};

    private readonly baseUrl: string = "https://chatgpt.com";

    private constructor() {
        console.log(
            "ChatGptApiClient instance created in Service Worker context.",
        );
    }

    public static getInstance(): ChatGptApiClient {
        if (!ChatGptApiClient.instance) {
            ChatGptApiClient.instance = new ChatGptApiClient();
        }
        return ChatGptApiClient.instance;
    }

    public async setHeaders(newHeaders: RequestHeaders): Promise<void> {
        this.headers = {
            ...newHeaders,
            "Content-Type": "application/json",
        };
        console.log(
            "ChatGptApiClient: Headers updated in instance",
            this.headers,
        );
    }

    public static async initialize(): Promise<void> {
        const instance = ChatGptApiClient.getInstance();
        const storedHeaders = await getStoredHeadersFromWorker();
        instance.setHeaders(storedHeaders);
    }

    private getHeaders(): RequestHeaders {
        if (!this.headers["Authorization"] || !this.headers["OAI-Device-Id"]) {
            console.warn(
                "ChatGptApiClient: Attempting to get headers, but required fields might be missing.",
                this.headers,
            );
        }
        return { ...this.headers };
    }

    public async refreshHeadersFromStorage(): Promise<void> {
        const storedHeaders = await getStoredHeadersFromWorker();
        this.setHeaders(storedHeaders);
    }

    private async makeRequest<T>(
        endpoint: string,
        method: string,
        body?: any,
        responseType: "json" | "blob" = "json",
    ): Promise<T> {
        const currentHeaders = this.getHeaders();

        if (
            !currentHeaders["Authorization"] ||
            !currentHeaders["OAI-Device-Id"]
        ) {
            console.error(
                "ChatGptApiClient: Required headers (Authorization or OAI-Device-Id) are missing.",
                currentHeaders,
            );
            throw new Error(
                "Required headers (Authorization or OAI-Device-Id) are not available.",
            );
        }

        const fetchOptions: RequestInit = {
            method,
            headers: currentHeaders,
            credentials: "include",
            body: body ? JSON.stringify(body) : undefined,
        };

        console.log(
            `ChatGptApiClient: Making ${method} request to ${this.baseUrl}${endpoint}`,
        );

        const response = await fetch(
            `${this.baseUrl}${endpoint}`,
            fetchOptions,
        );

        console.log(
            `ChatGptApiClient: Received response ${response.status} for ${method} ${endpoint}`,
        );

        if (!response.ok) {
            let errorBody = "";
            try {
                errorBody = await response.text();
            } catch (_) {}
            console.error(
                `ChatGptApiClient: API request failed: ${response.status} ${response.statusText}. Body: ${errorBody}`,
            );
            throw new Error(
                `API request failed: ${response.status} ${response.statusText}. ${errorBody}`,
            );
        }

        if (responseType === "blob") {
            return response.blob() as Promise<T>;
        }

        if (
            response.status === 204 ||
            response.headers.get("content-length") === "0"
        ) {
            console.log(
                `ChatGptApiClient: Received empty response body (Status: ${response.status})`,
            );
            return {} as T;
        }

        try {
            const jsonData = await response.json();

            return jsonData;
        } catch (e) {
            console.error(
                "ChatGptApiClient: Failed to parse JSON response.",
                e,
            );
            throw new Error("Failed to parse JSON response from API.");
        }
    }

    public async getConversations(
        offset: number = 0,
        limit: number = 28,
        order: string = "updated",
    ): Promise<any> {
        return this.makeRequest(
            `/backend-api/conversations?offset=${offset}&limit=${limit}&order=${order}`,
            "GET",
        );
    }

    public async deleteConversation(conversationId: string): Promise<any> {
        return this.makeRequest(
            `/backend-api/conversation/${conversationId}`,
            "PATCH",
            { is_visible: false },
        );
    }

    public async shareConversation(
        conversationId: string,
        currentNodeId: string,
    ): Promise<any> {
        return this.makeRequest(`/backend-api/share/create`, "POST", {
            current_node_id: currentNodeId,
            conversation_id: conversationId,
            is_anonymous: true,
        });
    }

    public async getConversation(conversationId: string): Promise<any> {
        return this.makeRequest(
            `/backend-api/conversation/${conversationId}`,
            "GET",
        );
    }

    public async archiveConversation(conversationId: string): Promise<any> {
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
        return this.makeRequest(
            `/backend-api/conversation/implicit_message_feedback`,
            "POST",
            {
                message_id: messageId,
                conversation_id: conversationId,
                source: "mouse",
                feedback: {
                    feedback_type: "copy",
                    selected_text: selectedText,
                },
                location: "message",
            },
        );
    }

    public async getAudio(
        messageId: string,
        conversationId: string,
        voice: string = "orbit",
        format: string = "aac",
    ): Promise<Blob> {
        const url = `/backend-api/synthesize?message_id=${messageId}&conversation_id=${conversationId}&voice=${voice}&format=${format}`;

        return this.makeRequest<Blob>(url, "GET", undefined, "blob");
    }

    public async markMessageThumbsUp(
        messageId: string,
        conversationId: string,
    ): Promise<any> {
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
