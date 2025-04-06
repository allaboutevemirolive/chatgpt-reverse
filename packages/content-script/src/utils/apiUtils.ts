// packages/content-script/src/utils/apiUtils.ts
import { sendMessageToSW, SendMessageToSW } from "./swMessenger";

// --- Generic API Action Caller ---

/**
 * Sends an action message to the service worker and returns the response data on success.
 * Handles potential payload building and standard SW communication errors.
 *
 * @param type The message type indicating the action to perform.
 * @param payloadBuilder A function (sync or async) that returns the payload for the message.
 * @param messageSender The function used to send messages to the service worker (dependency injection).
 * @returns A promise resolving with the data field from the service worker's successful response.
 * @throws An error if the payload builder fails, the service worker communication fails,
 *         or the service worker indicates an error in its response.
 */
export async function callServiceWorkerAction<T = any>(
    type: string,
    payloadBuilder: () => any | Promise<any>,
    messageSender: SendMessageToSW = sendMessageToSW,
): Promise<T> {
    let payload: any;
    try {
        payload = await Promise.resolve(payloadBuilder());
        if (payload === undefined) {
            console.warn(
                `Payload builder for action "${type}" returned undefined. Sending empty payload.`,
            );
            payload = {};
        }
    } catch (error) {
        console.error(`Error building payload for action "${type}":`, error);
        throw new Error(
            `Failed to prepare data for action "${type}": ${(error as Error).message}`,
        );
    }

    try {
        const message = { type, payload: payload ?? {} };
        const data = await messageSender<T>(message);
        return data;
    } catch (error) {
        console.error(`Error calling service worker action "${type}":`, error);
        throw error;
    }
}

// --- Specific API Action Wrappers ---

// -- Conversation List --
interface FetchConversationsParams {
    offset?: number | string;
    limit?: number | string;
    order?: string;
}
type ConversationSummary = {
    id: string;
    title: string;
    create_time: number /* ... */;
};
type ConversationListResponse = {
    items: ConversationSummary[];
    total: number;
    limit: number;
    offset: number;
};

export async function fetchConversations(
    params: FetchConversationsParams = {},
    messageSender?: SendMessageToSW,
): Promise<ConversationListResponse> {
    const offset = Number(params.offset) || 0;
    const limit = Number(params.limit) || 28;
    const order = params.order || "updated";
    const payloadBuilder = () => ({ offset, limit, order });
    console.log(
        `fetchConversations API util: Requesting with payload:`,
        payloadBuilder(),
    );
    return callServiceWorkerAction<ConversationListResponse>(
        "FETCH_CONVERSATIONS",
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Single Conversation --
type ConversationDetailResponse = any; // Replace any with specific type if known

export async function fetchConversationDetail(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<ConversationDetailResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<ConversationDetailResponse>(
        "FETCH_CONVERSATION",
        payloadBuilder,
        messageSender,
    );
}

// -- Delete Conversation --
export async function deleteConversationById(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required to delete.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction(
        "DELETE_CONVERSATION",
        payloadBuilder,
        messageSender,
    );
}

// -- Share Conversation --
interface ShareConversationParams {
    conversationId: string;
    currentNodeId: string;
}
type ShareResponse = { share_url?: string;[key: string]: any };

export async function shareConversation(
    params: ShareConversationParams,
    messageSender?: SendMessageToSW,
): Promise<ShareResponse> {
    if (!params.conversationId?.trim() || !params.currentNodeId?.trim()) {
        throw new Error("Conversation ID and Current Node ID are required.");
    }
    const payloadBuilder = () => ({
        conversationId: params.conversationId.trim(),
        currentNodeId: params.currentNodeId.trim(),
    });
    return callServiceWorkerAction<ShareResponse>(
        "SHARE_CONVERSATION",
        payloadBuilder,
        messageSender,
    );
}

// -- Archive Conversation --
export async function archiveConversation(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required to archive.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction(
        "ARCHIVE_CONVERSATION",
        payloadBuilder,
        messageSender,
    );
}

// -- Rename Conversation --
export async function renameConversation(
    conversationId: string,
    newTitle: string,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!conversationId?.trim() || !newTitle?.trim()) {
        throw new Error("Conversation ID and New Title are required.");
    }
    const payloadBuilder = () => ({
        conversationId: conversationId.trim(),
        newTitle: newTitle.trim(),
    });
    return callServiceWorkerAction(
        "RENAME_CONVERSATION",
        payloadBuilder,
        messageSender,
    );
}

// -- Generate Autocompletions --
interface AutocompletionsParams {
    inputText: string;
    numCompletions?: number | string;
    inSearchMode?: boolean | string;
}
type AutocompletionsResponse = { completions?: string[];[key: string]: any };

export async function generateAutocompletions(
    params: AutocompletionsParams,
    messageSender?: SendMessageToSW,
): Promise<AutocompletionsResponse> {
    if (params.inputText == null)
        throw new Error("Input text is required for autocompletions.");
    const payloadBuilder = () => ({
        inputText: params.inputText,
        numCompletions: Number(params.numCompletions) || 4,
        inSearchMode:
            params.inSearchMode === "true" || params.inSearchMode === true,
    });
    return callServiceWorkerAction<AutocompletionsResponse>(
        "GENERATE_AUTOCOMPLETIONS",
        payloadBuilder,
        messageSender,
    );
}

// -- Send Copy Feedback --
interface CopyFeedbackParams {
    messageId: string;
    conversationId: string;
    selectedText: string;
}

export async function sendCopyFeedback(
    params: CopyFeedbackParams,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (
        !params.messageId?.trim() ||
        !params.conversationId?.trim() ||
        params.selectedText == null
    ) {
        throw new Error(
            "Message ID, Conversation ID, and Selected Text are required.",
        );
    }
    const payloadBuilder = () => params;
    return callServiceWorkerAction(
        "SEND_COPY_FEEDBACK",
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Audio (Returns Data for Download Trigger) --
interface FetchAudioParams {
    messageId: string;
    conversationId: string;
    voice?: string;
    format?: string;
}
type FetchAudioResponse = {
    dataUrl: string;
    format: string;
    messageId: string;
};

export async function fetchAudioData(
    params: FetchAudioParams,
    messageSender?: SendMessageToSW,
): Promise<FetchAudioResponse> {
    if (!params.messageId?.trim() || !params.conversationId?.trim()) {
        throw new Error("Message ID and Conversation ID are required.");
    }
    const payloadBuilder = () => ({
        messageId: params.messageId.trim(),
        conversationId: params.conversationId.trim(),
        voice: params.voice || "alloy",
        format: params.format || "aac",
    });
    return callServiceWorkerAction<FetchAudioResponse>(
        "GET_AUDIO",
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Conversation Message IDs --
type ConversationMessageId = { id: string; author: string /* ... */ };
type FetchMessageIdsResponse = ConversationMessageId[];

export async function fetchConversationMessageIds(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<FetchMessageIdsResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<FetchMessageIdsResponse>(
        "FETCH_CONVERSATION_MESSAGE_IDS",
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Conversation Messages --
type MessageInfo = { id: string; role: string; parts: string[] /* ... */ };
type FetchMessagesResponse = MessageInfo[];

export async function fetchConversationMessages(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<FetchMessagesResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<FetchMessagesResponse>(
        "FETCH_CONVERSATION_MESSAGES",
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Conversation Context --
type ContextInfo = {
    id: string;
    role: string;
    model_set_context: string | null /* ... */;
};
type FetchContextResponse = ContextInfo[];

export async function fetchConversationContext(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<FetchContextResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<FetchContextResponse>(
        "FETCH_CONVERSATION_CONTEXT",
        payloadBuilder,
        messageSender,
    );
}

// -- Mark Message Thumbs Up/Down --
interface FeedbackParams {
    messageId: string;
    conversationId: string;
}

export async function markMessageThumbsUp(
    params: FeedbackParams,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!params.messageId?.trim() || !params.conversationId?.trim()) {
        throw new Error("Message ID and Conversation ID are required.");
    }
    const payloadBuilder = () => params;
    return callServiceWorkerAction(
        "MARK_MESSAGE_THUMBS_UP",
        payloadBuilder,
        messageSender,
    );
}

export async function markMessageThumbsDown(
    params: FeedbackParams,
    messageSender?: SendMessageToSW,
): Promise<any> {
    if (!params.messageId?.trim() || !params.conversationId?.trim()) {
        throw new Error("Message ID and Conversation ID are required.");
    }
    const payloadBuilder = () => params;
    return callServiceWorkerAction(
        "MARK_MESSAGE_THUMBS_DOWN",
        payloadBuilder,
        messageSender,
    );
}

// -- Export Conversation (Returns Data for Download Trigger) --
type FetchExportDataResponse = {
    markdownContent: string;
    createTime: number;
    title: string;
};

export async function fetchMarkdownExportData(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<FetchExportDataResponse> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<FetchExportDataResponse>(
        "EXPORT_CONVERSATION_MARKDOWN",
        payloadBuilder,
        messageSender,
    );
}

// -- Fetch Conversation Author Counts --
type AuthorCounts = { user: number; assistant: number /* ... */ };

export async function fetchConversationAuthorCounts(
    conversationId: string,
    messageSender?: SendMessageToSW,
): Promise<AuthorCounts> {
    if (!conversationId?.trim())
        throw new Error("Conversation ID is required.");
    const payloadBuilder = () => ({ conversationId: conversationId.trim() });
    return callServiceWorkerAction<AuthorCounts>(
        "FETCH_CONVERSATION_AUTHOR_COUNTS",
        payloadBuilder,
        messageSender,
    );
}
